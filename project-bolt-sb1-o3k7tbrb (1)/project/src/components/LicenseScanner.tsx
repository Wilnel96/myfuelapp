import { useEffect, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';
import { BrowserPDF417Reader, BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';

interface LicenseScannerProps {
  onScan: (data: ParsedLicenseData) => void;
  onCancel: () => void;
}

export interface ParsedLicenseData {
  firstName: string;
  lastName: string;
  idNumber: string;
  dateOfBirth: string;
  licenseNumber: string;
  licenseIssueDate: string;
  licenseExpiryDate: string;
  licenseType: string;
  address?: string;
}

export default function LicenseScanner({ onScan, onCancel }: LicenseScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserPDF417Reader | BrowserMultiFormatReader | null>(null);
  const [scanAttempt, setScanAttempt] = useState(0);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        startScanning();
      }
    } catch (err: any) {
      setError('Failed to access camera: ' + err.message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const startScanning = async () => {
    if (!videoRef.current || scanning) return;

    setScanning(true);

    try {
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.PURE_BARCODE, false);

      if (scanAttempt === 0) {
        console.log('Trying PDF417Reader with lenient hints...');
        readerRef.current = new BrowserPDF417Reader(hints);
      } else {
        console.log('Trying MultiFormatReader as fallback...');
        readerRef.current = new BrowserMultiFormatReader(hints);
      }

      const result = await readerRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error) => {
          if (result) {
            const text = result.getText();
            console.log('Successfully scanned barcode!');
            console.log('Format:', result.getBarcodeFormat());
            console.log('Raw data:', text);

            const parsedData = parseSouthAfricanLicense(text);
            if (parsedData) {
              stopCamera();
              onScan(parsedData);
            } else {
              console.log('Parse failed, displaying raw data anyway');
              setError('Scanned but could not parse. Check console for raw data.');
            }
          }

          if (error && error.name !== 'NotFoundException' && error.name !== 'ChecksumException') {
            console.error('Scan error:', error);
          }
        }
      );
    } catch (err: any) {
      console.error('Scanner error:', err);
      setError('Scanner error: ' + err.message);
      setScanning(false);
    }
  };

  const parseSouthAfricanLicense = (data: string): ParsedLicenseData | null => {
    try {
      console.log('Raw barcode data:', data);
      console.log('Data length:', data.length);

      const parsedData: Partial<ParsedLicenseData> = {};

      const idMatch = data.match(/\d{13}/);
      if (idMatch) {
        parsedData.idNumber = idMatch[0];
        const year = parsedData.idNumber.substring(0, 2);
        const month = parsedData.idNumber.substring(2, 4);
        const day = parsedData.idNumber.substring(4, 6);
        const yearFull = parseInt(year) > 50 ? `19${year}` : `20${year}`;
        parsedData.dateOfBirth = `${yearFull}-${month}-${day}`;
      }

      const lines = data.split(/[\n\r]+/).map(line => line.trim()).filter(line => line.length > 0);
      console.log('Split lines:', lines);

      for (const line of lines) {
        if (!parsedData.firstName && line.match(/^[A-Z][a-z]+$/)) {
          parsedData.firstName = line;
        }

        if (!parsedData.lastName && line.match(/^[A-Z][A-Z\s]+$/) && line.length > 2) {
          parsedData.lastName = line.trim();
        }

        if (!parsedData.licenseNumber && line.match(/^[A-Z0-9]{8,15}$/) && !line.match(/^\d{13}$/)) {
          parsedData.licenseNumber = line;
        }

        if (line.match(/^\d{8}$/)) {
          const formatted = `${line.substring(0, 4)}-${line.substring(4, 6)}-${line.substring(6, 8)}`;
          if (!parsedData.licenseIssueDate) {
            parsedData.licenseIssueDate = formatted;
          } else if (!parsedData.licenseExpiryDate) {
            parsedData.licenseExpiryDate = formatted;
          }
        }

        if (line.match(/\d{4}-\d{2}-\d{2}/)) {
          const dateMatch = line.match(/\d{4}-\d{2}-\d{2}/);
          if (dateMatch) {
            if (!parsedData.licenseIssueDate) {
              parsedData.licenseIssueDate = dateMatch[0];
            } else if (!parsedData.licenseExpiryDate) {
              parsedData.licenseExpiryDate = dateMatch[0];
            }
          }
        }

        if (line.match(/^[A-C]1?$/)) {
          parsedData.licenseType = `Code ${line}`;
        }

        if (line.match(/CODE\s*[A-C]1?/i)) {
          const codeMatch = line.match(/CODE\s*([A-C]1?)/i);
          if (codeMatch) {
            parsedData.licenseType = `Code ${codeMatch[1]}`;
          }
        }

        if (line.length > 20 && line.includes(',')) {
          parsedData.address = line;
        }
      }

      if (!parsedData.firstName || !parsedData.lastName) {
        const namePattern = /([A-Z][A-Z\s]+)[,\s]+([A-Z][a-z]+)/;
        const nameMatch = data.match(namePattern);
        if (nameMatch) {
          parsedData.lastName = nameMatch[1].trim();
          parsedData.firstName = nameMatch[2].trim();
        }
      }

      console.log('Parsed data:', parsedData);

      if (parsedData.idNumber) {
        return {
          firstName: parsedData.firstName || '',
          lastName: parsedData.lastName || '',
          idNumber: parsedData.idNumber || '',
          dateOfBirth: parsedData.dateOfBirth || '',
          licenseNumber: parsedData.licenseNumber || '',
          licenseIssueDate: parsedData.licenseIssueDate || '',
          licenseExpiryDate: parsedData.licenseExpiryDate || '',
          licenseType: parsedData.licenseType || 'Code B',
          address: parsedData.address,
        };
      }

      return null;
    } catch (err) {
      console.error('Parse error:', err);
      return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Camera className="w-6 h-6" />
          <div>
            <h2 className="text-lg font-semibold">Scan Driver's License</h2>
            <p className="text-sm text-gray-300">Position the PDF417 barcode in view</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              stopCamera();
              setScanAttempt((prev) => (prev + 1) % 2);
              setTimeout(() => startScanning(), 500);
            }}
            className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded"
          >
            Switch Mode
          </button>
          <button
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            className="text-white hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          className="max-w-full max-h-full"
          playsInline
          muted
        />

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-2 border-blue-500 w-3/4 h-32 rounded-lg">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
          </div>
        </div>
      </div>

      {error && (
        <div className="absolute bottom-20 left-4 right-4 bg-red-600 text-white p-4 rounded-lg shadow-lg">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="bg-gray-900 text-white p-4 text-center">
        <p className="text-sm text-gray-300">
          {scanning ? 'Scanning for barcode...' : 'Initializing camera...'}
        </p>
      </div>
    </div>
  );
}
