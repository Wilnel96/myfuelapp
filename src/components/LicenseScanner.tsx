import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, RefreshCw, ZoomIn } from 'lucide-react';
import { BrowserPDF417Reader, BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

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

// South African driver's license PDF417 binary format parser
// The barcode encodes fixed-length fields in a specific binary layout
function parseSouthAfricanLicense(rawText: string): ParsedLicenseData | null {
  try {
    console.log('Raw scan length:', rawText.length);
    console.log('Raw (first 200 chars):', rawText.substring(0, 200));

    // SA license disk PDF417 uses a binary format.
    // Try to extract structured fields from the raw bytes.
    // The standard SA driver's license card PDF417 layout:
    //   - Starts with a header (country code, version, etc.)
    //   - Contains fixed-width fields for name, surname, ID number, dates, license codes

    // Convert to byte array for binary parsing
    const bytes: number[] = [];
    for (let i = 0; i < rawText.length; i++) {
      bytes.push(rawText.charCodeAt(i));
    }

    const result: Partial<ParsedLicenseData> = {};

    // --- Strategy 1: Parse as SA license binary format ---
    // SA PDF417 structure (approximate offsets based on AARTO format):
    // The data typically starts with "SAEZ" or similar header
    // Fields are null-terminated or fixed-width ASCII strings

    // Look for ID number pattern (13 digits) anywhere in the data
    const idMatch = rawText.match(/\b(\d{13})\b/);
    if (idMatch) {
      result.idNumber = idMatch[1];
      const year = result.idNumber.substring(0, 2);
      const month = result.idNumber.substring(2, 4);
      const day = result.idNumber.substring(4, 6);
      const yearFull = parseInt(year) > 30 ? `19${year}` : `20${year}`;
      result.dateOfBirth = `${yearFull}-${month}-${day}`;
      console.log('Found ID:', result.idNumber);
    }

    // Look for dates in YYYYMMDD format (8 consecutive digits that form a valid date)
    const dateMatches = [...rawText.matchAll(/\b(19|20)(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/g)];
    const validDates: string[] = [];
    for (const m of dateMatches) {
      const formatted = `${m[1]}${m[2]}-${m[3]}-${m[4]}`;
      if (!validDates.includes(formatted)) validDates.push(formatted);
    }
    // Also check DDMMYYYY format
    const datesAlt = [...rawText.matchAll(/\b(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(19|20)(\d{2})\b/g)];
    for (const m of datesAlt) {
      const formatted = `${m[3]}${m[4]}-${m[2]}-${m[1]}`;
      if (!validDates.includes(formatted)) validDates.push(formatted);
    }
    console.log('Found dates:', validDates);

    if (validDates.length >= 1 && !result.licenseIssueDate) result.licenseIssueDate = validDates[0];
    if (validDates.length >= 2 && !result.licenseExpiryDate) result.licenseExpiryDate = validDates[1];

    // --- Strategy 2: Extract printable ASCII strings ---
    // Pull out runs of printable ASCII characters (length >= 2)
    const strings: string[] = [];
    let current = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b >= 32 && b < 127) {
        current += String.fromCharCode(b);
      } else {
        if (current.length >= 2) strings.push(current.trim());
        current = '';
      }
    }
    if (current.length >= 2) strings.push(current.trim());

    console.log('Extracted strings:', strings.filter(s => s.length > 0));

    // Find name fields: SA licenses store SURNAME then NAMES
    // Look for all-caps strings (surnames) and mixed-case strings (first names)
    const upperStrings = strings.filter(s => /^[A-Z][A-Z\s\-']{1,}$/.test(s) && s.length >= 2 && s.length <= 40);
    const nameStrings = strings.filter(s => /^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(s) && s.length >= 2 && s.length <= 30);

    // Exclude known non-name patterns
    const nonNamePatterns = /^(ZA|SA|RSA|CODE|REPUBLIC|SOUTH|AFRICA|SOUTH AFRICA|LICENSE|LICENCE|DRIVER)$/i;

    const surnames = upperStrings.filter(s => !nonNamePatterns.test(s));
    const firstNames = nameStrings.filter(s => !nonNamePatterns.test(s));

    console.log('Potential surnames:', surnames);
    console.log('Potential first names:', firstNames);

    if (surnames.length > 0 && !result.lastName) result.lastName = surnames[0];
    if (firstNames.length > 0 && !result.firstName) result.firstName = firstNames[0];

    // Fallback: look for NAME: or SURNAME: patterns
    const surnameTag = rawText.match(/SURNAME[:\s]+([A-Z][A-Z\s]+)/i);
    const nameTag = rawText.match(/(?:NAMES?|FIRSTNAME)[:\s]+([A-Z][a-zA-Z\s]+)/i);
    if (surnameTag && !result.lastName) result.lastName = surnameTag[1].trim();
    if (nameTag && !result.firstName) result.firstName = nameTag[1].trim();

    // License number: alphanumeric, 6-12 chars, not the ID number
    const licenseNumMatch = strings.find(s =>
      /^[A-Z0-9]{6,12}$/.test(s) &&
      !/^\d{13}$/.test(s) &&
      s !== result.idNumber
    );
    if (licenseNumMatch) result.licenseNumber = licenseNumMatch;

    // License type/code
    const codeMatch = rawText.match(/\b(EB|B|C1|C|EC1|EC|A1|A|PrDP)\b/g);
    if (codeMatch && codeMatch.length > 0) {
      // EB is most common SA license code (equivalent to old Code 8)
      result.licenseType = codeMatch.includes('EB') ? 'Code EB' :
        codeMatch.includes('B') ? 'Code B' :
        `Code ${codeMatch[0]}`;
    }

    // Address: look for strings with numbers and slashes typical of SA addresses
    const addressStr = strings.find(s => s.length > 15 && /\d/.test(s) && s.includes(' '));
    if (addressStr) result.address = addressStr;

    console.log('Final parsed result:', result);

    // Return even partial data as long as we got something useful
    if (result.idNumber || result.lastName || result.licenseNumber) {
      return {
        firstName: result.firstName || '',
        lastName: result.lastName || '',
        idNumber: result.idNumber || '',
        dateOfBirth: result.dateOfBirth || '',
        licenseNumber: result.licenseNumber || '',
        licenseIssueDate: result.licenseIssueDate || '',
        licenseExpiryDate: result.licenseExpiryDate || '',
        licenseType: result.licenseType || 'Code EB',
        address: result.address,
      };
    }

    return null;
  } catch (err) {
    console.error('Parse error:', err);
    return null;
  }
}

export default function LicenseScanner({ onScan, onCancel }: LicenseScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('Initializing camera...');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    startCamera();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (readerRef.current?.reset) {
      try { readerRef.current.reset(); } catch (_) {}
    }
    readerRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const startCamera = async () => {
    setError('');
    setStatus('Starting camera...');
    try {
      // Try rear camera first with high res for barcode scanning
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: 'environment' },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
        });
      } catch {
        // Fall back to any camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      }

      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('Camera ready — scanning for barcode...');
        startScanning();
      }
    } catch (err: any) {
      setError('Camera access denied: ' + err.message);
    }
  };

  const startScanning = useCallback(async () => {
    if (!videoRef.current || scanning) return;
    setScanning(true);

    try {
      // Try PDF417 first (SA license disk uses PDF417)
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);

      readerRef.current = new BrowserPDF417Reader(hints);

      readerRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result: any, err: any) => {
          if (!mountedRef.current) return;

          if (result) {
            const text = result.getText();
            console.log('Barcode detected! Format:', result.getBarcodeFormat());
            setScanCount(c => c + 1);
            setStatus('Barcode detected — parsing...');

            const parsed = parseSouthAfricanLicense(text);
            if (parsed) {
              cleanup();
              onScan(parsed);
            } else {
              // Still got a scan — return raw data with what we have
              console.warn('Could not fully parse — returning raw');
              setStatus('Scanned but could not parse SA license format. Try again.');
              setError('');
            }
          }

          if (err && err.name !== 'NotFoundException' && err.name !== 'ChecksumException' && err.name !== 'FormatException') {
            console.warn('Scan error:', err.name);
          }
        }
      );
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error('Scanner init error:', err);
      // Fall back to MultiFormatReader
      try {
        const hints2 = new Map();
        hints2.set(DecodeHintType.TRY_HARDER, true);
        readerRef.current = new BrowserMultiFormatReader(hints2);
        readerRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result: any, err2: any) => {
            if (!mountedRef.current) return;
            if (result) {
              const parsed = parseSouthAfricanLicense(result.getText());
              if (parsed) { cleanup(); onScan(parsed); }
            }
          }
        );
      } catch (err2: any) {
        setError('Scanner failed to start: ' + err2.message);
        setScanning(false);
      }
    }
  }, [scanning, onScan]);

  const handleRetry = () => {
    cleanup();
    setTimeout(() => {
      if (mountedRef.current) startCamera();
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Camera className="w-6 h-6 text-blue-400" />
          <div>
            <h2 className="text-lg font-semibold">Scan Driver's License</h2>
            <p className="text-xs text-gray-400">Point camera at the PDF417 barcode on the back</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
          <button
            onClick={() => { cleanup(); onCancel(); }}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Scan overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {/* Dark overlay with cutout */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Scan target box — wide and short for barcode */}
          <div className="relative z-10 w-[85%] max-w-sm">
            <div className="relative border-2 border-blue-400 rounded-lg h-24 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              {/* Corner markers */}
              <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl" />
              <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr" />
              <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl" />
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br" />

              {/* Animated scan line */}
              {scanning && (
                <div
                  className="absolute left-1 right-1 h-0.5 bg-blue-400/80 rounded"
                  style={{ animation: 'scanline 2s ease-in-out infinite', top: '50%' }}
                />
              )}
            </div>

            <p className="text-white text-center text-xs mt-3 font-medium drop-shadow">
              Align the barcode (PDF417) within the box
            </p>
            <p className="text-gray-300 text-center text-xs mt-1 drop-shadow">
              The barcode is on the back of the license card
            </p>
          </div>
        </div>

        {/* Scan count indicator */}
        {scanCount > 0 && (
          <div className="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            {scanCount} scan{scanCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-700 text-white px-4 py-3 flex-shrink-0">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Status bar */}
      <div className="bg-gray-900 text-white px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          {scanning && (
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
          )}
          <p className="text-sm text-gray-300">{status}</p>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Tip: Hold steady, ensure good lighting, get close to the barcode
        </p>
      </div>

      <style>{`
        @keyframes scanline {
          0%, 100% { transform: translateY(-20px); opacity: 0.4; }
          50% { transform: translateY(20px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
