import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';

interface VoiceInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  numeric?: boolean;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

export default function VoiceInput({ value, onChange, disabled, numeric = false }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);
  const appendedFinalRef = useRef('');
  const lastResultIndexRef = useRef(0);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Voice input not supported on this browser');
      return;
    }

    const recognition = new SpeechRecognition() as SpeechRecognitionLike;
    recognition.lang = 'en-ZA';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const trimmed = transcript.trim();
          if (trimmed && !appendedFinalRef.current.endsWith(trimmed)) {
            const current = valueRef.current;
            if (numeric) {
              const digits = trimmed.replace(/\D/g, '');
              if (digits) {
                onChange(digits);
              }
            } else {
              const separator = current && !current.endsWith(' ') ? ' ' : '';
              const newValue = current + separator + trimmed;
              onChange(newValue);
              valueRef.current = newValue;
            }
            appendedFinalRef.current += (appendedFinalRef.current ? ' ' : '') + trimmed;
          }
        } else {
          interimText += transcript;
        }
      }

      setInterim(interimText);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone permission.');
      } else if (event.error === 'no-speech') {
        // Ignore - silence detected
      } else {
        setError('Voice input error: ' + event.error);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // already stopped
      }
    };
  }, [onChange]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (disabled) return;

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      setInterim('');
    } else {
      setError('');
      appendedFinalRef.current = '';
      lastResultIndexRef.current = 0;
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch {
        // start() throws if already started
        setListening(false);
      }
    }
  };

  const supported = recognitionRef.current !== null || error !== 'Voice input not supported on this browser';
  const browserUnsupported = error === 'Voice input not supported on this browser';

  if (browserUnsupported) {
    return null;
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          listening
            ? 'bg-red-100 text-red-700 hover:bg-red-200'
            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={listening ? 'Stop voice input' : 'Start voice input'}
      >
        {listening ? (
          <>
            <Square className="w-4 h-4 fill-current" />
            <span>Stop</span>
          </>
        ) : (
          <>
            <Mic className="w-4 h-4" />
            <span>Speak</span>
          </>
        )}
      </button>
      {listening && (
        <span className="ml-2 text-xs text-gray-500">
          {interim ? `"${interim}"` : 'Listening...'}
        </span>
      )}
      {error && !browserUnsupported && (
        <span className="ml-2 text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}


export default VoiceInput