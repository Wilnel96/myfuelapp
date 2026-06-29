import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, Keyboard, Zap, CheckCircle, Wifi } from 'lucide-react';
import { BrowserPDF417Reader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

interface BarcodeScannerProps {
  onScan: (data: string) => void;
  onCancel: () => void;
  label: string;
}

// Returns true if Chrome/Android native BarcodeDetector is available
function hasNativeDetector(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

export default function BarcodeScanner({ onScan, onCancel, label }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zxingControlsRef = useRef<any>(null);
  const activeRef = useRef(true);
  const detectorRef = useRef<any>(null);

  const [scannedData, setScannedData] = useState('');
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [scanMethod, setScanMethod] = useState<'native' | 'zxing' | null>(null);
  const [framesScanned, setFramesScanned] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const stopAll = useCallback(() => {
    activeRef.current = false;
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (zxingControlsRef.current) {
      try { zxingControlsRef.current.stop(); } catch (_) {}
      zxingControlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsScanning(false);
  }, []);

  const handleFound = useCallback((data: string) => {
    if (!data || !data.trim()) return;
    stopAll();
    setScannedData(data.trim());
  }, [stopAll]);

  // ---------- Native BarcodeDetector scan loop (Chrome / Android) ----------
  const runNativeLoop = useCallback(async () => {
    const detector = detectorRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!detector || !video || !canvas || !activeRef.current) return;
    if (video.readyState < 2 || !video.videoWidth) {
      scanTimerRef.current = setTimeout(runNativeLoop, 150);
      return;
    }

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    setFramesScanned(n => n + 1);

    try {
      const barcodes: any[] = await detector.detect(canvas);
      if (barcodes && barcodes.length > 0) {
        const found =
          barcodes.find(b => (b.format || '').toLowerCase().includes('pdf')) ||
          barcodes[0];
        if (found?.rawValue) {
          handleFound(found.rawValue);
          return;
        }
      }
    } catch (_) {}

    if (activeRef.current) {
      scanTimerRef.current = setTimeout(runNativeLoop, 120);
    }
  }, [handleFound]);

  const startNativeScanning = useCallback(async (stream: MediaStream): Promise<boolean> => {
    if (!hasNativeDetector()) return false;
    try {
      let formats: string[] = [];
      try {
        formats = await (window as any).BarcodeDetector.getSupportedFormats();
      } catch (_) {}

      let detector: any;
      if (formats.length > 0) {
        // Use all supported formats — pdf417 data arrives as whatever format string Chrome uses
        detector = new (window as any).BarcodeDetector({ formats });
      } else {
        detector = new (window as any).BarcodeDetector();
      }
      detectorRef.current = detector;
    } catch {
      return false;
    }

    setScanMethod('native');
    setIsScanning(true);

    // Check torch availability on the camera track
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        const caps = track.getCapabilities() as any;
        if (caps?.torch) setTorchAvailable(true);
      } catch (_) {}
    }

    runNativeLoop();
    return true;
  }, [runNativeLoop]);

  // ---------- ZXing fallback ----------
  const startZxingScanning = useCallback(async (stream: MediaStream) => {
    if (!videoRef.current) return;
    setScanMethod('zxing');
    setIsScanning(true);

    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);

    const reader = new BrowserPDF417Reader(hints, {
      delayBetweenScanAttempts: 100,
      delayBetweenScanSuccess: 500,
    });

    try {
      const controls = await reader.decodeFromStream(
        stream,
        videoRef.current,
        (result) => {
          if (result && activeRef.current) handleFound(result.getText());
        }
      );
      zxingControlsRef.current = controls;
      if (typeof (controls as any).switchTorch === 'function') setTorchAvailable(true);
    } catch (e) {
      console.error('ZXing error:', e);
    }
  }, [handleFound]);

  // ---------- Main start ----------
  const startScanning = useCallback(async () => {
    stopAll();
    activeRef.current = true;
    setError('');
    setScannedData('');
    setFramesScanned(0);
    setTorchOn(false);
    setTorchAvailable(false);
    setScanMethod(null);
    detectorRef.current = null;

    await new Promise<void>(r => setTimeout(r, 80));
    if (!videoRef.current) {
      setError('Camera could not initialise. Tap Retry.');
      return;
    }

    let stream: MediaStream | null = null;
    // Try HD first, fall back to default
    for (const hd of [true, false]) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: hd ? {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          } : { facingMode: { ideal: 'environment' } },
        });
        break;
      } catch (_) {}
    }

    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera permission denied. In your browser settings, allow camera access for this site, then tap Retry.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found. Enter the registration number manually.');
        } else {
          setError(`Camera error: ${err.message || err.name}. Tap Retry or enter manually.`);
        }
        return;
      }
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try { await videoRef.current.play(); } catch (_) {}
    }

    const nativeOk = await startNativeScanning(stream);
    if (!nativeOk) {
      await startZxingScanning(stream);
    }
  }, [stopAll, startNativeScanning, startZxingScanning]);

  useEffect(() => {
    startScanning();
    return () => stopAll();
  }, []);

  const handleToggleTorch = async () => {
    const next = !torchOn;
    // Try native track torch
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      try {
        await (track as any).applyConstraints({ advanced: [{ torch: next }] });
        setTorchOn(next);
        return;
      } catch (_) {}
    }
    // ZXing torch fallback
    if (zxingControlsRef.current?.switchTorch) {
      try { await zxingControlsRef.current.switchTorch(next); setTorchOn(next); } catch (_) {}
    }
  };

  const handleRescan = () => {
    setScannedData('');
    setShowManual(false);
    startScanning();
  };

  const handleConfirm = () => {
    if (scannedData) onScan(scannedData);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = manualInput.trim().toUpperCase();
    if (val) onScan(val);
  };

  const handleCancel = () => {
    stopAll();
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-white text-base font-semibold truncate">{label}</h2>
          {scanMethod && (
            <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-1">
              <Wifi className="w-3 h-3 flex-shrink-0" />
              {scanMethod === 'native' ? 'Hardware scanner active' : 'Software scanner active'}
              {framesScanned > 0 && (
                <span className="ml-1 text-green-400">{framesScanned} frames processed</span>
              )}
            </p>
          )}
        </div>
        <button onClick={handleCancel} className="text-white hover:text-gray-300 p-1 ml-3 flex-shrink-0">
          <X className="w-6 h-6" />
        </button>
      </div>

      {!showManual ? (
        <>
          <div className="flex-1 bg-black relative overflow-hidden">
            {/* Hidden canvas used for native BarcodeDetector frame capture */}
            <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

            {/* Live video feed */}
            <video
              ref={videoRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: scannedData ? 'none' : 'block',
              }}
              playsInline
              muted
              autoPlay
            />

            {/* Scan overlay */}
            {!scannedData && isScanning && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center px-4">
                {/* Wide rectangle target — PDF417 barcodes are wide, not square */}
                <div className="relative w-full max-w-sm" style={{ aspectRatio: '4.5 / 1' }}>
                  <div className="absolute inset-0 border-2 border-green-400/40 rounded" />
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-green-400 rounded-tl-sm" />
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-green-400 rounded-tr-sm" />
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-green-400 rounded-bl-sm" />
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-green-400 rounded-br-sm" />
                  {/* Animated red scan line */}
                  <div
                    className="absolute left-1 right-1 h-0.5 bg-red-500 opacity-90"
                    style={{ animation: 'scanline 1.6s ease-in-out infinite' }}
                  />
                </div>

                <div className="mt-4 bg-black/75 rounded-xl px-4 py-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
                  <span className="text-white text-sm font-medium">Scanning for PDF417 barcode</span>
                </div>

                <div className="mt-2 bg-black/60 rounded-lg px-3 py-1.5 text-center max-w-xs">
                  <p className="text-gray-300 text-xs leading-relaxed">
                    The barcode is the <strong className="text-white">stack of thin lines</strong> on the bottom-right of the license disk sticker
                  </p>
                </div>
              </div>
            )}

            {/* Camera starting */}
            {!scannedData && !isScanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white text-center">
                  <Camera className="w-12 h-12 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm">Starting camera...</p>
                </div>
              </div>
            )}

            {/* Torch button */}
            {torchAvailable && isScanning && !scannedData && (
              <button
                onClick={handleToggleTorch}
                className={`absolute top-3 right-3 p-2.5 rounded-full pointer-events-auto shadow-lg transition-colors ${
                  torchOn ? 'bg-yellow-400 text-gray-900' : 'bg-black/70 text-white'
                }`}
              >
                <Zap className="w-5 h-5" />
              </button>
            )}

            {/* Success overlay */}
            {scannedData && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/95 p-6">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
                    <CheckCircle className="w-9 h-9 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Barcode Captured!</h3>
                  <p className="text-sm text-gray-500 mb-4">License disk barcode read successfully.</p>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-left">
                    <p className="text-xs font-medium text-gray-400 mb-1">Raw data ({scannedData.length} chars)</p>
                    <p className="text-xs font-mono text-gray-700 break-all line-clamp-4">
                      {scannedData.substring(0, 200)}{scannedData.length > 200 ? '…' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="bg-red-700 text-white px-4 py-3 flex-shrink-0">
              <p className="text-sm text-center leading-snug">{error}</p>
            </div>
          )}

          {/* Bottom controls */}
          <div className="bg-gray-900 p-4 flex-shrink-0">
            {scannedData ? (
              <div className="flex gap-3">
                <button
                  onClick={handleRescan}
                  className="flex-1 bg-gray-700 text-white py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-600 active:bg-gray-500 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Rescan
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 bg-green-600 text-white py-3.5 rounded-xl font-semibold hover:bg-green-700 active:bg-green-800 transition-colors"
                >
                  Use This Scan
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleRescan}
                  className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 active:bg-blue-800 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={() => { stopAll(); setShowManual(true); }}
                  className="flex-1 bg-gray-700 text-white py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-600 active:bg-gray-500 transition-colors"
                >
                  <Keyboard className="w-4 h-4" />
                  Enter Manually
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Manual entry */
        <div className="flex-1 bg-gray-900 flex items-start justify-center p-6 pt-10 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Enter Registration Number</h3>
            <p className="text-sm text-gray-500 mb-5">
              Type the registration exactly as shown on the license disk (e.g. CA 123 456).
            </p>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <input
                type="text"
                value={manualInput}
                onChange={e => setManualInput(e.target.value.toUpperCase())}
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-4 text-2xl font-bold tracking-widest uppercase text-center focus:border-blue-500 focus:outline-none"
                placeholder="CA 123 456"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
              />
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-base hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Use This Registration
              </button>
              <button
                type="button"
                onClick={() => { setShowManual(false); startScanning(); }}
                className="w-full bg-gray-100 text-gray-700 py-3.5 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Try Camera Again
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scanline {
          0%, 100% { top: 5%; }
          50% { top: 85%; }
        }
      `}</style>
    </div>
  );
}
