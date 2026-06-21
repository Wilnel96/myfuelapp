import { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Scan } from 'lucide-react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

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
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    startScanning();
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      setIsScanning(true);
      setError('');

      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserMultiFormatReader();
      }

      const videoInputDevices = await codeReaderRef.current.listVideoInputDevices();

      if (videoInputDevices.length === 0) {
        throw new Error('No camera found');
      }

      const selectedDeviceId = videoInputDevices[0].deviceId;

      await codeReaderRef.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current!,
        (result, error) => {
          if (result) {
            setScannedData(result.getText());
            setIsScanning(false);
            stopScanning();
          }
          if (error && !(error instanceof NotFoundException)) {
            console.error('Scan error:', error);
          }
        }
      );
    } catch (err) {
      console.error('Camera error:', err);
      setError('Failed to access camera. You can enter the code manually.');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
  };

  const handleRescan = () => {
    setScannedData('');
    setError('');
    startScanning();
  };

  const handleConfirm = () => {
    if (scannedData) {
      onScan(scannedData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="bg-gray-900 p-4 flex items-center justify-between">
        <h2 className="text-white text-lg font-semibold">{label}</h2>
        <button onClick={onCancel} className="text-white hover:text-gray-300">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
        {!scannedData && (
          <>
            <video
              ref={videoRef}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain'
              }}
              playsInline
              autoPlay
            />

            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-4 border-green-500 rounded-lg w-4/5 h-2/5">
                  <div className="relative w-full h-full">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-green-500 animate-pulse"></div>
                  </div>
                </div>
              </div>
            )}

            <div className="absolute bottom-24 left-0 right-0 flex justify-center">
              <div className="bg-black bg-opacity-75 text-white px-6 py-3 rounded-lg flex items-center gap-3">
                <Scan className="w-6 h-6 animate-pulse" />
                <span className="font-medium">Position barcode in frame</span>
              </div>
            </div>
          </>
        )}

        {scannedData && (
          <div className="flex items-center justify-center h-full p-6 bg-gray-900">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 w-full max-w-md">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-3">
                  <Camera className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  Code Captured!
                </h3>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-300">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Scanned Data:
                </p>
                <p className="text-base text-gray-900 font-mono break-all bg-gray-50 p-3 rounded border border-gray-200">
                  {scannedData}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-600 text-white p-4">
          <p className="text-center font-medium">{error}</p>
        </div>
      )}

      <div className="bg-gray-900 p-4">
        {scannedData && (
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleRescan}
              className="bg-gray-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-gray-600"
            >
              <RefreshCw className="w-5 h-5" />
              Rescan
            </button>
            <button
              onClick={handleConfirm}
              className="bg-green-600 text-white px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-green-700"
            >
              <Camera className="w-5 h-5" />
              Confirm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
