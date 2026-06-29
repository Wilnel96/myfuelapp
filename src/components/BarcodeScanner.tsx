import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, Keyboard, Zap, CheckCircle } from 'lucide-react';
import { BrowserPDF417Reader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

interface BarcodeScannerProps {
  onScan: (data: string) => void;
  onCancel: () => void;
  label: string;
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
  const [statusLine, setStatusLine] = useState('Starting camera...');
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const log = useCallback((msg: string) => {
    console.log('[Scanner]', msg);
    setDebugLines(prev => [...prev.slice(-39), msg]);
    setStatusLine(msg);
  }, []);

  const stopAll = useCallback(() => {
    activeRef.current = false;
    if (scanTimerRef.current) { clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
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
    if (!data?.trim()) return;
    log(`Barcode found (${data.length} chars)`);
    stopAll();
    setScannedData(data.trim());
  }, [stopAll, log]);

  // ── Native BarcodeDetector loop ──────────────────────────────────────────
  const runNativeLoop = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current || !canvasRef.current || !activeRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2 || !video.videoWidth) {
      scanTimerRef.current = setTimeout(runNativeLoop, 200);
      return;
    }
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    setFramesScanned(n => n + 1);
    try {
      const barcodes: any[] = await detectorRef.current.detect(canvas);
      if (barcodes?.length) {
        const found = barcodes.find(b =>
          (b.format || '').toLowerCase().includes('pdf') ||
          (b.format || '').toLowerCase().includes('417')
        ) || barcodes[0];
        if (found?.rawValue) { handleFound(found.rawValue); return; }
      }
    } catch (_) {}
    if (activeRef.current) scanTimerRef.current = setTimeout(runNativeLoop, 150);
  }, [handleFound]);

  // ── Try native BarcodeDetector (only if PDF417 in supported formats) ──────
  const tryNative = useCallback(async (stream: MediaStream): Promise<boolean> => {
    if (!('BarcodeDetector' in window)) { log('No BarcodeDetector API'); return false; }
    let supported: string[] = [];
    try {
      supported = await (window as any).BarcodeDetector.getSupportedFormats();
      log(`Native formats: ${supported.join(', ')}`);
    } catch { return false; }
    const fmt = supported.find(f => f.toLowerCase().includes('pdf') || f.toLowerCase().includes('417'));
    if (!fmt) { log('PDF417 not in native formats → using ZXing'); return false; }
    try {
      detectorRef.current = new (window as any).BarcodeDetector({ formats: [fmt] });
    } catch { return false; }
    const track = stream.getVideoTracks()[0];
    if (track) {
      try { if ((track.getCapabilities() as any)?.torch) setTorchAvailable(true); } catch (_) {}
    }
    setScanMethod('native');
    setIsScanning(true);
    log(`Native scanner active (${fmt})`);
    runNativeLoop();
    return true;
  }, [runNativeLoop, log]);

  // ── ZXing via decodeFromConstraints (fully managed) ───────────────────────
  const startZxing = useCallback(async () => {
    if (!videoRef.current) return;
    log('Starting ZXing PDF417 (decodeFromConstraints)...');

    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);

    const reader = new BrowserPDF417Reader(hints, {
      delayBetweenScanAttempts: 150,
      delayBetweenScanSuccess: 500,
    });

    setScanMethod('zxing');
    setIsScanning(true);

    try {
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        videoRef.current,
        (result, err) => {
          if (result && activeRef.current) {
            handleFound(result.getText());
          }
          // Increment frame counter on any callback (result or NotFoundException)
          if (activeRef.current) setFramesScanned(n => n + 1);
          if (err && !(err as any).message?.includes('NotFoundException') &&
              !(err as any).message?.includes('No MultiFormat')) {
            log(`ZXing: ${(err as any).message?.substring(0, 60)}`);
          }
        }
      );
      zxingControlsRef.current = controls;

      // Capture stream reference for torch
      if (videoRef.current?.srcObject instanceof MediaStream) {
        streamRef.current = videoRef.current.srcObject;
        const track = streamRef.current.getVideoTracks()[0];
        if (track) {
          try { if ((track.getCapabilities() as any)?.torch) setTorchAvailable(true); } catch (_) {}
        }
      }
      if (typeof (controls as any).switchTorch === 'function') setTorchAvailable(true);
      log('ZXing scanning active');
    } catch (e: any) {
      const msg = e?.message || String(e);
      log(`ZXing failed: ${msg}`);
      if (msg.includes('NotAllowed') || msg.includes('PermissionDenied')) {
        setError('Camera permission denied. Allow camera access in browser settings, then tap Retry.');
      } else if (msg.includes('NotFound')) {
        setError('No camera found. Enter the registration number manually.');
      } else {
        setError(`Camera error: ${msg}. Tap Retry or enter manually.`);
      }
      setIsScanning(false);
    }
  }, [handleFound, log]);

  // ── Main start ─────────────────────────────────────────────────────────────
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
    log('Initialising...');

    await new Promise<void>(r => setTimeout(r, 100));
    if (!videoRef.current) { setError('Camera could not initialise. Tap Retry.'); return; }

    // Only attempt native if BarcodeDetector exists AND supports PDF417.
    // Native path needs its own stream to check formats; ZXing manages its own stream.
    if ('BarcodeDetector' in window) {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch { /* will fall through to ZXing */ }
        }
      }

      if (stream) {
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch (_) {}
        const nativeOk = await tryNative(stream);
        if (nativeOk) return;
        // Native doesn't support PDF417 — hand off to ZXing which manages its own stream
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        videoRef.current.srcObject = null;
      }
    } else {
      log('No BarcodeDetector — using ZXing directly');
    }

    await startZxing();
  }, [stopAll, tryNative, startZxing, log]);

  useEffect(() => {
    startScanning();
    return () => stopAll();
  }, []);

  const handleToggleTorch = async () => {
    const next = !torchOn;
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      try { await (track as any).applyConstraints({ advanced: [{ torch: next }] }); setTorchOn(next); return; } catch (_) {}
    }
    if (zxingControlsRef.current?.switchTorch) {
      try { await zxingControlsRef.current.switchTorch(next); setTorchOn(next); } catch (_) {}
    }
  };

  const handleRescan = () => { setScannedData(''); setShowManual(false); startScanning(); };
  const handleConfirm = () => { if (scannedData) onScan(scannedData); };
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = manualInput.trim().toUpperCase();
    if (val) onScan(val);
  };
  const handleCancel = () => { stopAll(); onCancel(); };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-white text-sm font-semibold truncate">{label}</h2>
          <button onClick={() => setShowDebug(d => !d)} className="text-left w-full">
            <p className="text-gray-400 text-xs mt-0.5 truncate">
              {scanMethod === 'native' && '⚡ Hardware '}
              {scanMethod === 'zxing' && '🔍 ZXing '}
              {framesScanned > 0 && <span className="text-green-400">{framesScanned} frames — </span>}
              <span className="text-gray-500">{statusLine}</span>
            </p>
          </button>
        </div>
        <button onClick={handleCancel} className="text-white hover:text-gray-300 p-1 ml-2 flex-shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Debug log */}
      {showDebug && (
        <div className="bg-black border-b border-gray-800 px-2 py-1.5 max-h-36 overflow-y-auto flex-shrink-0">
          {debugLines.map((l, i) => (
            <p key={i} className="text-green-400 text-xs font-mono leading-tight">{l}</p>
          ))}
        </div>
      )}

      {!showManual ? (
        <>
          <div className="flex-1 bg-black relative overflow-hidden min-h-0">
            <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

            <video
              ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: scannedData ? 'none' : 'block' }}
              playsInline muted autoPlay
            />

            {/* Scan overlay — large frame, 3:1 ratio so barcode fits with room for height */}
            {!scannedData && isScanning && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center px-3">
                {/* Dimmed surround */}
                <div className="absolute inset-0 bg-black/30" />

                {/* Clear scan window — 3:1 aspect, full width minus small margin */}
                <div className="relative w-full" style={{ aspectRatio: '3 / 1', zIndex: 1 }}>
                  {/* Clear cutout (lighter than surround) */}
                  <div className="absolute inset-0 bg-transparent" />
                  {/* Border */}
                  <div className="absolute inset-0 border-2 border-green-400/60 rounded-sm" />
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br" />
                  {/* Animated scan line */}
                  <div
                    className="absolute left-2 right-2 h-0.5 bg-red-500"
                    style={{ animation: 'scanline 1.8s ease-in-out infinite' }}
                  />
                  {/* Center guide label */}
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                    <span className="bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                      Align barcode within frame
                    </span>
                  </div>
                </div>

                {/* Instruction below frame */}
                <div className="mt-3 bg-black/80 rounded-lg px-3 py-2 text-center max-w-xs" style={{ zIndex: 1 }}>
                  <p className="text-gray-200 text-xs leading-relaxed">
                    The PDF417 barcode is the <strong className="text-white">stack of lines</strong> on the bottom-right of the license disk.
                    Hold steady, 15–25 cm away.
                  </p>
                </div>
              </div>
            )}

            {/* Starting state */}
            {!scannedData && !isScanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white text-center">
                  <Camera className="w-10 h-10 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm">Starting camera...</p>
                </div>
              </div>
            )}

            {/* Torch button */}
            {torchAvailable && isScanning && !scannedData && (
              <button
                onClick={handleToggleTorch}
                className={`absolute top-3 right-3 p-2.5 rounded-full shadow-lg transition-colors pointer-events-auto ${
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
                  <p className="text-sm text-gray-500 mb-3">License disk barcode read successfully.</p>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-left">
                    <p className="text-xs text-gray-400 mb-1">{scannedData.length} characters</p>
                    <p className="text-xs font-mono text-gray-700 break-all line-clamp-3">
                      {scannedData.substring(0, 150)}{scannedData.length > 150 ? '…' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="bg-red-700 text-white px-4 py-2.5 flex-shrink-0">
              <p className="text-sm text-center leading-snug">{error}</p>
            </div>
          )}

          {/* Bottom controls */}
          <div className="bg-gray-900 px-4 py-3 flex-shrink-0">
            {scannedData ? (
              <div className="flex gap-3">
                <button onClick={handleRescan}
                  className="flex-1 bg-gray-700 text-white py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-600 transition-colors">
                  <RefreshCw className="w-4 h-4" />Rescan
                </button>
                <button onClick={handleConfirm}
                  className="flex-1 bg-green-600 text-white py-3.5 rounded-xl font-semibold hover:bg-green-700 transition-colors">
                  Use This Scan
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={handleRescan}
                  className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
                  <RefreshCw className="w-4 h-4" />Retry
                </button>
                <button onClick={() => { stopAll(); setShowManual(true); }}
                  className="flex-1 bg-gray-700 text-white py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-600 transition-colors">
                  <Keyboard className="w-4 h-4" />Enter Manually
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
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
                autoFocus autoComplete="off" autoCorrect="off" spellCheck={false} inputMode="text"
              />
              <button
                type="submit" disabled={!manualInput.trim()}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-base hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                Use This Registration
              </button>
              <button
                type="button" onClick={() => { setShowManual(false); startScanning(); }}
                className="w-full bg-gray-100 text-gray-700 py-3.5 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                <Camera className="w-4 h-4" />Try Camera Again
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scanline {
          0%, 100% { top: 8%; }
          50% { top: 82%; }
        }
      `}</style>
    </div>
  );
}
