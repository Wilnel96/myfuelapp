import { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Scan, Keyboard } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';

interface BarcodeScannerProps {
  onScan: (data: string) => void;
  onCancel: () => void;
  label: string;
}

export default function BarcodeScanner({ onScan, onCancel, label }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scannedData, setScannedData] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startScanning();
    return () => {
      stopScanning();
    };
  }, []);

  const stopScanning = () => {
    if (codeReaderRef.current) {
      try { codeReaderRef.current.reset(); } catch (_) { /* ignore */ }
      codeReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const startScanning = async () => {
    stopScanning();
    setError('');
    setScannedData('');

    try {
      // Request rear camera explicitly — avoids front-facing camera on mobile
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsScanning(true);

      codeReaderRef.current = new BrowserMultiFormatReader();

      await codeReaderRef.current.decodeFromStream(
        stream,
        videoRef.current!,
        (result, err) => {
          if (result) {
            const text = result.getText();
            setScannedData(text);
            stopScanning();
          }
          if (err && !(err instanceof NotFoundException) && err.name !== 'NotFoundException') {
            // Non-fatal scan errors — suppress, scanning continues
          }
        }
      );
    } catch (err: any) {
      console.error('Camera/scan error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access and try again, or enter the registration number manually.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device. Please enter the registration number manually.');
      } else {
        setError('Could not start camera. Please enter the registration number manually.');
      }
      setIsScanning(false);
    }
  };

  const handleRescan = () => {
    setScannedData('');
    setError('');
    setShowManual(false);
    startScanning();
  };

  const handleConfirm = () => {
    if (scannedData) {
      onScan(scannedData);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualInput.trim().toUpperCase();
    if (trimmed) {
      onScan(trimmed);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="bg-gray-900 p-4 flex items-center justify-between flex-shrink-0">
        <h2 className="text-white text-lg font-semibold">{label}</h2>
        <button onClick={() => { stopScanning(); onCancel(); }} className="text-white hover:text-gray-300 p-1">
          <X className="w-6 h-6" />
        </button>
      </div>

      {!showManual ? (
        <>
          <div className="flex-1 bg-black relative overflow-hidden">
            {!scannedData && (
              <>
                <video
                  ref={videoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  playsInline
                  muted
                />

                {isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-4 border-green-400 rounded-xl w-4/5 h-1/3">
                      <div className="relative w-full h-full">
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-400 animate-[scan_2s_ease-in-out_infinite]" />
                      </div>
                    </div>
                    <div className="absolute bottom-1/3 mb-4 left-0 right-0 flex justify-center" style={{ bottom: 'calc(33% + 1rem)' }}>
                      <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                        <Scan className="w-4 h-4 animate-pulse text-green-400" />
                        <span>Hold barcode steady in the frame</span>
                      </div>
                    </div>
                  </div>
                )}

                {!isScanning && !error && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white text-center">
                      <Camera className="w-12 h-12 mx-auto mb-3 animate-pulse" />
                      <p>Starting camera...</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {scannedData && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 p-6">
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 w-full max-w-md">
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-3">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-green-900 mb-1">Barcode Captured!</h3>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-green-300">
                    <p className="text-xs font-medium text-gray-500 mb-1">Scanned Data:</p>
                    <p className="text-sm text-gray-900 font-mono break-all bg-gray-50 p-2 rounded border border-gray-200 max-h-24 overflow-y-auto">
                      {scannedData}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-700 text-white px-4 py-3 flex-shrink-0">
              <p className="text-sm text-center">{error}</p>
            </div>
          )}

          <div className="bg-gray-900 p-4 flex-shrink-0">
            {scannedData ? (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleRescan}
                  className="flex-1 bg-gray-700 text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-600 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  Rescan
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-colors font-semibold"
                >
                  Confirm
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleRescan}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={() => { stopScanning(); setShowManual(true); }}
                  className="flex-1 bg-gray-700 text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-600 transition-colors"
                >
                  <Keyboard className="w-4 h-4" />
                  Enter Manually
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 bg-gray-900 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Enter Registration Number</h3>
            <p className="text-sm text-gray-500 mb-4">Type the vehicle registration number exactly as it appears on the license disk.</p>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <input
                type="text"
                value={manualInput}
                onChange={e => setManualInput(e.target.value.toUpperCase())}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-4 text-xl font-bold tracking-widest uppercase text-center focus:border-blue-500 focus:outline-none"
                placeholder="e.g. CA123456"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Use This Registration
              </button>
              <button
                type="button"
                onClick={() => { setShowManual(false); startScanning(); }}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Try Camera Again
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
