import { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Check, AlertCircle, Loader2, Pencil } from 'lucide-react';
import Tesseract from 'tesseract.js';

interface PumpScannerProps {
  onConfirm: (result: { liters: string; amount: string; image: string | null }) => void;
  onCancel: () => void;
}

function compressImage(dataUrl: string, maxW = 800, quality = 0.7): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function normalizeNumber(s: string): string {
  return s.replace(',', '.').replace(/[^\d.]/g, '');
}

function parsePumpDisplay(text: string): { liters: string; amount: string } {
  const cleaned = text.replace(/\s+/g, ' ');

  // Litres: number followed by L / l / LTR / litre(s)
  const literMatch =
    cleaned.match(/(\d{1,4}[.,]\d{1,2})\s*(?:l|ltr|litre|liter)s?\b/i) ||
    cleaned.match(/\b(\d{1,4}[.,]\d{1,2})\s*l\b/i);

  // Rand amount: R prefix, or "ZAR", or a 2-decimal value labelled total/rand
  const randMatch =
    cleaned.match(/(?:r|zar)\s*(\d{1,6}[.,]\d{2})\b/i) ||
    cleaned.match(/(\d{1,6}[.,]\d{2})\s*(?:rand|zar|total)/i);

  let liters = literMatch ? normalizeNumber(literMatch[1]) : '';
  let amount = randMatch ? normalizeNumber(randMatch[1]) : '';

  // Fallback: collect all decimal numbers, pick the two most plausible
  if (!liters || !amount) {
    const nums = Array.from(cleaned.matchAll(/\d{1,6}[.,]\d{1,3}/g))
      .map(m => normalizeNumber(m[0]))
      .filter(n => parseFloat(n) > 0)
      .map(n => parseFloat(n));

    if (nums.length >= 2) {
      // Rand total is typically the larger of the two main readings
      const sorted = [...nums].sort((a, b) => b - a);
      const big = sorted[0];
      const small = sorted.find(n => n !== big && n < 200) ?? sorted[1];
      if (!amount && big >= 10) amount = big.toFixed(2);
      if (!liters && small > 0 && small < 400) liters = small.toFixed(2);
    } else if (nums.length === 1) {
      if (!liters) liters = nums[0].toFixed(2);
      else if (!amount) amount = nums[0].toFixed(2);
    }
  }

  return { liters, amount };
}

export default function PumpScanner({ onConfirm, onCancel }: PumpScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [captured, setCaptured] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{ liters: string; amount: string } | null>(null);
  const [editLiters, setEditLiters] = useState('');
  const [editAmount, setEditAmount] = useState('');

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startCamera = async () => {
    setError('');
    setCaptured(null);
    setParsed(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access.');
      } else {
        setError('Could not start camera: ' + (err?.message || err));
      }
    }
  };

  const captureAndRead = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    setProcessing(true);
    setError('');

    try {
      // Crop the centre of the frame where the pump display numbers are
      const canvas = document.createElement('canvas');
      const cropW = video.videoWidth;
      const cropH = Math.min(video.videoHeight, video.videoWidth * 0.6);
      const offY = Math.floor((video.videoHeight - cropH) / 2);
      canvas.width = cropW * 2; // upscale small pump digits for better OCR
      canvas.height = cropH * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(video, 0, offY, cropW, cropH, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      setCaptured(dataUrl);
      stopCamera();

      const { data } = await Tesseract.recognize(canvas, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') setProgress(Math.round((m.progress || 0) * 100));
        },
      });

      const result = parsePumpDisplay(data.text || '');
      if (!result.liters && !result.amount) {
        setError('Could not read numbers from the photo. Retake it with the display filling the frame and holding steady.');
        setParsed(null);
      } else {
        setParsed(result);
        setEditLiters(result.liters);
        setEditAmount(result.amount);
      }
    } catch (err: any) {
      setError('Reading failed: ' + (err?.message || err));
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const handleRetake = () => {
    setCaptured(null);
    setParsed(null);
    setEditLiters('');
    setEditAmount('');
    startCamera();
  };

  const handleConfirm = async () => {
    let image: string | null = null;
    if (captured) {
      try {
        image = await compressImage(captured);
      } catch {
        image = null;
      }
    }
    onConfirm({ liters: editLiters, amount: editAmount, image });
  };

  const cleanNum = (s: string) => s.replace(/[^0-9.,]/g, '').replace(',', '.');

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      <div className="bg-gray-800 p-4 flex items-center justify-between flex-shrink-0">
        <h2 className="text-white text-lg font-semibold">Scan Pump Display</h2>
        <button onClick={onCancel} className="text-white hover:text-gray-300 p-1">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!captured ? (
          <>
            <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3]">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
              {/* Framing guide over the centre band where the numbers should be */}
              <div className="absolute inset-x-[8%] top-1/2 -translate-y-1/2 h-[38%] border-2 border-yellow-400/80 rounded-lg pointer-events-none" />
              <div className="absolute inset-x-0 bottom-2 text-center text-yellow-200 text-xs pointer-events-none">
                Fit the pump numbers inside the yellow box
              </div>
            </div>

            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              onClick={captureAndRead}
              disabled={processing}
              className="mt-4 w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-500 transition-colors flex items-center justify-center gap-2 text-lg"
            >
              {processing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Reading numbers... {progress}%
                </>
              ) : (
                <>
                  <Camera className="w-6 h-6" />
                  Take Photo & Read Numbers
                </>
              )}
            </button>
            <p className="mt-3 text-xs text-gray-400 text-center">
              Hold the phone steady, fill the frame with the pump display, and avoid glare on the screen.
              You can correct the numbers before saving.
            </p>
          </>
        ) : (
          <>
            <img src={captured} alt="Pump display" className="w-full rounded-xl" />
            {processing ? (
              <div className="mt-6 text-center">
                <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-3" />
                <p className="text-gray-300">Reading the pump display... {progress}%</p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {parsed && (
                  <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5" />
                      Check and correct if needed, then confirm:
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Litres on pump</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editLiters}
                        onChange={e => setEditLiters(cleanNum(e.target.value))}
                        className="w-full border-2 border-gray-600 bg-gray-900 text-white text-xl rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
                        placeholder="e.g. 25.98"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Rand total on pump</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editAmount}
                        onChange={e => setEditAmount(cleanNum(e.target.value))}
                        className="w-full border-2 border-gray-600 bg-gray-900 text-white text-xl rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
                        placeholder="e.g. 649.53"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleConfirm}
                    disabled={!parsed}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-500 transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    Use These Numbers
                  </button>
                  <button
                    onClick={handleRetake}
                    className="px-5 bg-gray-700 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Retake
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
