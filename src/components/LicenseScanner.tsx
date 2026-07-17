import { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Scan, Keyboard, Image as ImageIcon, Loader2 } from 'lucide-react';
import { BrowserPDF417Reader } from '@zxing/browser';
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

// South African driver's license PDF417 parser
// The barcode encodes data in a structured binary/ASCII format
function parseSouthAfricanLicense(rawText: string): ParsedLicenseData | null {
  try {
    console.log('Raw scan length:', rawText.length);
    console.log('Raw data (hex of first 100):', Array.from(rawText.substring(0, 100)).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));

    const result: Partial<ParsedLicenseData> = {};

    // SA license disk PDF417: fields are separated by null bytes or other control chars
    // Extract all runs of printable ASCII (>= 2 chars)
    const strings: string[] = [];
    let current = '';
    for (let i = 0; i < rawText.length; i++) {
      const code = rawText.charCodeAt(i);
      if (code >= 32 && code < 127) {
        current += rawText[i];
      } else {
        if (current.trim().length >= 2) strings.push(current.trim());
        current = '';
      }
    }
    if (current.trim().length >= 2) strings.push(current.trim());

    console.log('Extracted strings:', strings);

    // Also work with the full raw text for regex searches
    const allText = strings.join(' ');

    // --- ID Number: 13 consecutive digits ---
    const idMatch = allText.match(/\b(\d{13})\b/) || rawText.match(/(\d{13})/);
    if (idMatch) {
      result.idNumber = idMatch[1];
      const yr = result.idNumber.substring(0, 2);
      const mo = result.idNumber.substring(2, 4);
      const dy = result.idNumber.substring(4, 6);
      const fullYear = parseInt(yr) > 30 ? `19${yr}` : `20${yr}`;
      result.dateOfBirth = `${fullYear}-${mo}-${dy}`;
      console.log('ID found:', result.idNumber);
    }

    // --- Dates: YYYYMMDD or CCYYMMDD patterns ---
    const datePattern = /\b(19|20)(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/g;
    const foundDates: string[] = [];
    let dm: RegExpExecArray | null;
    const searchStr = allText + ' ' + rawText;
    while ((dm = datePattern.exec(searchStr)) !== null) {
      const d = `${dm[1]}${dm[2]}-${dm[3]}-${dm[4]}`;
      if (!foundDates.includes(d)) foundDates.push(d);
    }
    console.log('Dates found:', foundDates);
    if (foundDates[0]) result.licenseIssueDate = foundDates[0];
    if (foundDates[1]) result.licenseExpiryDate = foundDates[1];

    // --- Names ---
    // SA licenses: SURNAME (all caps) then NAMES (mixed or caps)
    // Filter out noise words
    const noise = /^(ZA|SA|RSA|CODE|REPUBLIC|SOUTH|AFRICA|LICENSE|LICENCE|DRIVER|AARTO|ID|NO|NR|DOB)$/i;

    // Surname: all-caps string, 2-30 chars, letters only (may include hyphen/space)
    const surnames = strings.filter(s =>
      /^[A-Z][A-Z\s\-']{1,29}$/.test(s) &&
      s.replace(/\s/g, '').length >= 2 &&
      !noise.test(s.trim()) &&
      !/\d/.test(s)
    );

    // First name: starts capital, rest lower (or all caps shorter)
    const firstNames = strings.filter(s =>
      /^[A-Z][a-z]{1,}(\s[A-Z][a-z]+)*$/.test(s) &&
      !noise.test(s.trim()) &&
      !/\d/.test(s)
    );

    console.log('Surname candidates:', surnames);
    console.log('FirstName candidates:', firstNames);

    if (surnames.length > 0) result.lastName = surnames[0];
    if (firstNames.length > 0) result.firstName = firstNames[0];

    // Fallback: look adjacent to common field markers
    const snameTag = rawText.match(/SURNAME[^A-Z]*([A-Z][A-Z\s]{1,30})/i);
    const nameTag = rawText.match(/(?:NAMES?|FIRST\s*NAME)[^A-Z]*([A-Z][a-zA-Z\s]{1,30})/i);
    if (snameTag && !result.lastName) result.lastName = snameTag[1].trim();
    if (nameTag && !result.firstName) result.firstName = nameTag[1].trim();

    // --- License code (most common SA codes: EB, B, C1, C, EC1, EC, A) ---
    const codeMatch = allText.match(/\b(EB|EC1|EC|C1|B|C|A1|A)\b/g);
    if (codeMatch) {
      const preferred = ['EB', 'EC1', 'EC', 'C1', 'C', 'B', 'A1', 'A'];
      for (const pref of preferred) {
        if (codeMatch.includes(pref)) { result.licenseType = `Code ${pref}`; break; }
      }
    }

    console.log('Parsed result:', result);

    // Return if we got at least an ID number or surname
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
  const [isScanning, setIsScanning] = useState(false);
  const [scannedRaw, setScannedRaw] = useState('');
  const [parsedData, setParsedData] = useState<ParsedLicenseData | null>(null);
  const [error, setError] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualFields, setManualFields] = useState({ firstName: '', lastName: '', idNumber: '', licenseNumber: '', licenseType: 'Code EB', licenseIssueDate: '', licenseExpiryDate: '' });
  const codeReaderRef = useRef<BrowserPDF417Reader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoDecoding, setPhotoDecoding] = useState(false);

  useEffect(() => {
    startScanning();
    return () => stopScanning();
  }, []);

  const stopScanning = () => {
    if (codeReaderRef.current) {
      try { codeReaderRef.current.reset(); } catch (_) {}
      codeReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsScanning(false);
  };

  const startScanning = async () => {
    stopScanning();
    setError('');
    setScannedRaw('');
    setParsedData(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsScanning(true);

      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);

      codeReaderRef.current = new BrowserPDF417Reader(hints);

      await codeReaderRef.current.decodeFromStream(
        stream,
        videoRef.current!,
        (result, _err) => {
          if (result) {
            const text = result.getText();
            console.log('PDF417 decoded, length:', text.length);
            setScannedRaw(text);
            stopScanning();
            const parsed = parseSouthAfricanLicense(text);
            setParsedData(parsed);
          }
        }
      );
    } catch (err: any) {
      console.error('Scanner error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError('Could not start camera: ' + err.message);
      }
      setIsScanning(false);
    }
  };

  const handleConfirmParsed = () => {
    if (parsedData) onScan(parsedData);
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { e.target.value = ''; return; }
    setPhotoDecoding(true);
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = async () => {
        try {
          const hints = new Map();
          hints.set(DecodeHintType.TRY_HARDER, true);
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
          const reader = new BrowserPDF417Reader(hints);
          const result = await reader.decodeFromImageElement(img);
          const text = result.getText();
          URL.revokeObjectURL(url);
          setPhotoDecoding(false);
          stopScanning();
          setScannedRaw(text);
          const parsed = parseSouthAfricanLicense(text);
          setParsedData(parsed);
        } catch (err: any) {
          URL.revokeObjectURL(url);
          setPhotoDecoding(false);
          setError('Could not read barcode from photo. Try holding the camera closer and keeping the card flat, or use Retry.');
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setPhotoDecoding(false);
        setError('Could not load the photo. Please try again.');
      };
      img.src = url;
    } catch (err: any) {
      setPhotoDecoding(false);
      setError(`Photo error: ${err?.message || err}`);
    }
    e.target.value = '';
  };

  const handleConfirmManual = (e: React.FormEvent) => {
    e.preventDefault();
    const yr = manualFields.idNumber.substring(0, 2);
    const mo = manualFields.idNumber.substring(2, 4);
    const dy = manualFields.idNumber.substring(4, 6);
    const fullYear = parseInt(yr) > 30 ? `19${yr}` : `20${yr}`;
    onScan({
      firstName: manualFields.firstName.trim(),
      lastName: manualFields.lastName.trim(),
      idNumber: manualFields.idNumber.trim(),
      dateOfBirth: manualFields.idNumber.length === 13 ? `${fullYear}-${mo}-${dy}` : '',
      licenseNumber: manualFields.licenseNumber.trim(),
      licenseType: manualFields.licenseType,
      licenseIssueDate: manualFields.licenseIssueDate,
      licenseExpiryDate: manualFields.licenseExpiryDate,
    });
  };

  if (showManual) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        <div className="bg-gray-800 p-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-white text-lg font-semibold">Enter License Details</h2>
          <button onClick={() => { stopScanning(); onCancel(); }} className="text-white hover:text-gray-300 p-1">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <form onSubmit={handleConfirmManual} className="space-y-3 max-w-md mx-auto">
            {[
              { key: 'firstName', label: 'First Name', placeholder: 'John' },
              { key: 'lastName', label: 'Surname', placeholder: 'SMITH' },
              { key: 'idNumber', label: 'ID Number (13 digits)', placeholder: '8001015009087' },
              { key: 'licenseNumber', label: 'License Number', placeholder: 'SMITJ123456' },
              { key: 'licenseIssueDate', label: 'Issue Date', placeholder: '2020-01-15', type: 'date' },
              { key: 'licenseExpiryDate', label: 'Expiry Date', placeholder: '2025-01-15', type: 'date' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                <input
                  type={type || 'text'}
                  value={(manualFields as any)[key]}
                  onChange={e => setManualFields(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">License Code</label>
              <select
                value={manualFields.licenseType}
                onChange={e => setManualFields(prev => ({ ...prev, licenseType: e.target.value }))}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                {['Code EB', 'Code B', 'Code C1', 'Code C', 'Code EC1', 'Code EC', 'Code A1', 'Code A'].map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={!manualFields.firstName || !manualFields.lastName || !manualFields.idNumber}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors mt-2"
            >
              Save Driver Details
            </button>
            <button
              type="button"
              onClick={() => { setShowManual(false); startScanning(); }}
              className="w-full bg-gray-700 text-gray-200 py-3 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Try Camera Again
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="bg-gray-900 p-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-white text-lg font-semibold">Scan Driver's License</h2>
          <p className="text-xs text-gray-400">Point at the PDF417 barcode on the back of the card</p>
        </div>
        <button onClick={() => { stopScanning(); onCancel(); }} className="text-white hover:text-gray-300 p-1">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 bg-black relative overflow-hidden">
        {!scannedRaw && (
          <>
            <video
              ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              playsInline
              muted
            />
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-4 border-blue-400 rounded-xl w-4/5 h-1/4">
                  <div className="relative w-full h-full overflow-hidden rounded-lg">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-400 animate-[scan_2s_ease-in-out_infinite]" />
                  </div>
                </div>
                <div className="absolute top-2/3 left-0 right-0 flex justify-center">
                  <div className="bg-black/70 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                    <Scan className="w-4 h-4 animate-pulse text-blue-400" />
                    Hold the barcode steady in the frame
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

        {/* Scan result preview */}
        {scannedRaw && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 p-6 overflow-y-auto">
            <div className="w-full max-w-md">
              {parsedData ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                  <h3 className="text-green-900 font-semibold text-lg mb-3">License Scanned</h3>
                  <div className="space-y-2 text-sm">
                    {[
                      ['Name', `${parsedData.firstName} ${parsedData.lastName}`.trim()],
                      ['ID Number', parsedData.idNumber],
                      ['Date of Birth', parsedData.dateOfBirth],
                      ['License Code', parsedData.licenseType],
                      ['Issue Date', parsedData.licenseIssueDate],
                      ['Expiry Date', parsedData.licenseExpiryDate],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} className="flex justify-between border-b border-green-100 pb-1">
                        <span className="text-green-700 font-medium">{label}</span>
                        <span className="text-green-900">{value}</span>
                      </div>
                    ))}
                  </div>
                  {(!parsedData.firstName && !parsedData.lastName) && (
                    <p className="text-amber-700 text-xs mt-3 bg-amber-50 p-2 rounded">
                      Name could not be parsed automatically. You can correct it after saving.
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                  <h3 className="text-amber-900 font-semibold mb-2">Barcode Captured</h3>
                  <p className="text-amber-700 text-sm mb-3">The barcode was scanned but could not be parsed as an SA license. You can enter the details manually.</p>
                  <p className="text-xs font-mono text-gray-500 bg-white p-2 rounded border break-all max-h-20 overflow-y-auto">{scannedRaw.substring(0, 100)}...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-700 text-white px-4 py-3 flex-shrink-0 text-sm text-center">
          {error}
        </div>
      )}

      <div className="bg-gray-900 p-4 flex-shrink-0">
        {scannedRaw ? (
          <div className="flex gap-3">
            <button
              onClick={() => { setScannedRaw(''); startScanning(); }}
              className="flex-1 bg-gray-700 text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Rescan
            </button>
            {parsedData ? (
              <button
                onClick={handleConfirmParsed}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Confirm
              </button>
            ) : (
              <button
                onClick={() => setShowManual(true)}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Enter Manually
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={startScanning}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={photoDecoding}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              {photoDecoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              {photoDecoding ? 'Decoding...' : 'Capture Photo'}
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoCapture}
        className="hidden"
      />

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0; }
          50% { top: calc(100% - 2px); }
        }
      `}</style>
    </div>
  );
}
