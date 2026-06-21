import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, Check, X } from 'lucide-react';
import Tesseract from 'tesseract.js';

interface CameraScannerProps {
  onCapture: (image: string, extractedText: string) => void;
  onCancel: () => void;
  label: string;
}

export default function CameraScanner({ onCapture, onCancel, label }: CameraScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [manualEntry, setManualEntry] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const videoConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode: facingMode,
  };

  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      setIsProcessing(true);

      try {
        const result = await Tesseract.recognize(imageSrc, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`Progress: ${Math.round(m.progress * 100)}%`);
            }
          },
        });

        const fullText = result.data.text.trim();
        console.log('Full OCR text:', fullText);
        console.log('OCR confidence:', result.data.confidence);

        // Split into lines and words to analyze structure
        const lines = fullText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        console.log('Lines detected:', lines);

        // Try multiple patterns for South African registrations
        let extractedReg = '';

        // Pattern 1: Standard format with letters, numbers, and province code
        const standardPattern = /([A-Z]{2,3})\s*(\d{2,6})\s*([A-Z]{2})/gi;

        // Pattern 2: Letters followed by numbers (without province)
        const simplePattern = /([A-Z]{2,3})\s*(\d{2,6})/gi;

        // Search through all lines for registration patterns
        for (const line of lines) {
          const cleanLine = line.replace(/[^A-Z0-9\s]/gi, '').trim();
          console.log('Checking line:', cleanLine);

          // Try standard pattern first
          let match = cleanLine.match(standardPattern);
          if (match && match[0].length >= 6) {
            extractedReg = match[0];
            console.log('Standard pattern match:', extractedReg);
            break;
          }

          // Try simple pattern
          match = cleanLine.match(simplePattern);
          if (match && match[0].length >= 5) {
            extractedReg = match[0];
            console.log('Simple pattern match:', extractedReg);
            break;
          }
        }

        // If no pattern match, use the longest alphanumeric sequence
        if (!extractedReg) {
          const allWords = fullText.replace(/[^A-Z0-9\s]/gi, '').split(/\s+/);
          const alphanumericWords = allWords.filter(word =>
            /[A-Z]/i.test(word) && /\d/.test(word) && word.length >= 5
          );

          if (alphanumericWords.length > 0) {
            extractedReg = alphanumericWords.reduce((longest, current) =>
              current.length > longest.length ? current : longest
            );
            console.log('Fallback to longest alphanumeric:', extractedReg);
          }
        }

        // Final cleanup
        extractedReg = extractedReg.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();

        console.log('Final extracted registration:', extractedReg);
        setExtractedText(extractedReg || 'No registration detected');
      } catch (error) {
        console.error('OCR Error:', error);
        setExtractedText('OCR Error - Please retake');
      } finally {
        setIsProcessing(false);
      }
    }
  }, [webcamRef]);

  const retake = () => {
    setCapturedImage(null);
    setExtractedText('');
    setManualEntry('');
    setShowManualInput(false);
  };

  const confirm = () => {
    const finalText = showManualInput ? manualEntry.trim() : extractedText;
    if (capturedImage && finalText) {
      console.log('Confirming with text:', finalText);
      onCapture(capturedImage, finalText);
    } else {
      console.error('Cannot confirm - missing image or text');
      alert('No text detected. Please retake the photo or enter manually.');
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="bg-gray-900 p-4 flex items-center justify-between">
        <h2 className="text-white text-lg font-semibold">{label}</h2>
        <button
          onClick={onCancel}
          className="text-white hover:text-gray-300"
          disabled={isProcessing}
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {!capturedImage ? (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-4 border-white rounded-lg w-4/5 h-3/5 opacity-50"></div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <img src={capturedImage} alt="Captured" className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </div>

      {isProcessing && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-900 font-medium">Processing image...</p>
          </div>
        </div>
      )}

      {capturedImage && !isProcessing && (
        <div className="bg-yellow-50 border-t border-yellow-200 p-4">
          {!showManualInput ? (
            <>
              <p className="text-sm font-medium text-yellow-900 mb-1">Extracted Text:</p>
              <p className="text-sm text-yellow-800 font-mono bg-white p-2 rounded border border-yellow-200 mb-2">
                {extractedText || 'No text detected'}
              </p>
              <button
                onClick={() => setShowManualInput(true)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Enter manually instead
              </button>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-yellow-900 mb-2">
                Enter Registration Number:
              </label>
              <input
                type="text"
                value={manualEntry}
                onChange={(e) => setManualEntry(e.target.value.toUpperCase())}
                placeholder="e.g. ABC 123 GP"
                className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                autoFocus
              />
              <button
                onClick={() => setShowManualInput(false)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium mt-2"
              >
                Use OCR instead
              </button>
            </>
          )}
        </div>
      )}

      <div className="bg-gray-900 p-4">
        {!capturedImage ? (
          <div className="flex gap-4 justify-center">
            <button
              onClick={switchCamera}
              className="bg-gray-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-gray-600"
            >
              <RefreshCw className="w-5 h-5" />
              Switch Camera
            </button>
            <button
              onClick={capture}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700"
            >
              <Camera className="w-5 h-5" />
              Capture
            </button>
          </div>
        ) : (
          <div className="flex gap-4 justify-center">
            <button
              onClick={retake}
              className="bg-gray-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-gray-600"
              disabled={isProcessing}
            >
              <RefreshCw className="w-5 h-5" />
              Retake
            </button>
            <button
              onClick={confirm}
              className="bg-green-600 text-white px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isProcessing || (!showManualInput && (!extractedText || extractedText.includes('No registration') || extractedText.includes('Error'))) || (showManualInput && !manualEntry.trim())}
            >
              <Check className="w-5 h-5" />
              Confirm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
