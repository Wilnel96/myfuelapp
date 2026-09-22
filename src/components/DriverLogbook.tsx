import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Mic, Square, Plus, Trash2, Edit2, Check, X, Download, AlertCircle, CheckCircle, BookOpen, Car } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DriverLogbookProps {
  organizationId: string;
  driverId: string;
  driverName: string;
  onBack: () => void;
}

interface DrawnTrip {
  id: string;
  vehicleId: string;
  vehicleRegistration: string;
  vehicleMake: string;
  vehicleModel: string;
  odometerReading: number;
  drawnAt: string;
  returned: boolean;
  returnOdometer: number | null;
}

interface LogbookEntry {
  id: string;
  vehicle_transaction_id: string | null;
  vehicle_id: string;
  sequence_number: number;
  opening_km: number;
  trip_reason: string;
  closing_km: number | null;
  km_travelled: number | null;
  entry_date: string;
  created_at: string;
  vehicle_registration?: string;
  vehicle_make?: string;
  vehicle_model?: string;
}

type VoiceStep = 'idle' | 'asking_open_km' | 'asking_reason' | 'done';

// --- Word-to-number converter ---
// Speech recognition returns "twelve thousand three hundred forty five" as text.
// This converts spoken English number words into numeric digits.
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100, thousand: 1000, million: 1000000,
  // Common mishearings
  tree: 3, free: 3, for: 4, ate: 8, niner: 9,
};

function wordsToNumber(text: string): number | null {
  // First try: if the transcript already contains digits, extract them
  const digitsOnly = text.replace(/[^0-9]/g, '');
  if (digitsOnly) {
    const n = parseInt(digitsOnly, 10);
    return isNaN(n) ? null : n;
  }

  // Second try: convert word forms to numbers
  const lower = text.toLowerCase().trim();
  if (!lower) return null;

  // Handle "double three four" style or "three four five" digit-by-digit
  const words = lower.split(/[\s,\-]+/).filter(Boolean);
  const digitWords = words.filter(w =>
    ['zero','one','two','three','four','five','six','seven','eight','nine','tree','free','for','ate','niner']
      .includes(w)
  );
  // If all words are single-digit words, concatenate them
  if (digitWords.length > 1 && digitWords.length === words.length) {
    let concat = '';
    for (const w of digitWords) {
      const d = NUMBER_WORDS[w];
      if (d !== undefined && d < 10) concat += String(d);
    }
    if (concat) {
      const n = parseInt(concat, 10);
      return isNaN(n) ? null : n;
    }
  }

  // General word-to-number: handle "twelve thousand three hundred forty five"
  let total = 0;
  let current = 0;
  let foundAny = false;

  for (const word of words) {
    const val = NUMBER_WORDS[word];
    if (val === undefined) continue;
    foundAny = true;

    if (val === 100) {
      current = (current === 0 ? 1 : current) * 100;
    } else if (val >= 1000) {
      total += (current === 0 ? 1 : current) * val;
      current = 0;
    } else {
      current += val;
    }
  }

  total += current;
  return foundAny && total > 0 ? total : null;
}

// Convert spoken text to a km string, trying multiple strategies
function parseKmFromSpeech(text: string): string {
  // Strategy 1: direct digits in the transcript (e.g. "1 2 3 4 5" or "12345")
  const digitsOnly = text.replace(/[^0-9]/g, '');
  if (digitsOnly) return digitsOnly;

  // Strategy 2: word-to-number conversion
  const n = wordsToNumber(text);
  if (n !== null && n > 0) return String(n);

  // Strategy 3: try cleaning up common speech recognition artifacts
  // e.g. "one two three four five" -> extract individual digits
  const lower = text.toLowerCase().trim();
  const singleDigitMap: Record<string, string> = {
    zero: '0', one: '1', won: '1', two: '2', to: '2', too: '2',
    three: '3', tree: '3', free: '3', four: '4', for: '4',
    five: '5', six: '6', seven: '7', eight: '8', ate: '8',
    nine: '9', niner: '9',
  };
  const parts = lower.split(/[\s,\-]+/).filter(Boolean);
  let digitStr = '';
  let allDigits = true;
  for (const p of parts) {
    const d = singleDigitMap[p];
    if (d !== undefined) {
      digitStr += d;
    } else {
      allDigits = false;
    }
  }
  if (allDigits && digitStr) return digitStr;

  return '';
}

export default function DriverLogbook({ organizationId, driverId, driverName, onBack }: DriverLogbookProps) {
  const [trips, setTrips] = useState<DrawnTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<DrawnTrip | null>(null);
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Manual entry form state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualOpenKm, setManualOpenKm] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualCloseKm, setManualCloseKm] = useState('');
  const [saving, setSaving] = useState(false);

  // Voice guided entry state
  const [voiceStep, setVoiceStep] = useState<VoiceStep>('idle');
  const [voiceOpenKm, setVoiceOpenKm] = useState('');
  const [voiceReason, setVoiceReason] = useState('');
  const [voiceInterim, setVoiceInterim] = useState('');
  const [voiceError, setVoiceError] = useState('');  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const confirmingRef = useRef(false);
  const closingKmEntryIdRef = useRef<string | null>(null);
  const voiceStepRef = useRef<VoiceStep>('idle');
  const voiceValuesRef = useRef({ openKm: '', reason: '', closeKm: '' });

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOpenKm, setEditOpenKm] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editCloseKm, setEditCloseKm] = useState('');

  useEffect(() => {
    voiceStepRef.current = voiceStep;
  }, [voiceStep]);

  useEffect(() => {
    voiceValuesRef.current = { openKm: voiceOpenKm, reason: voiceReason, closeKm: '' };
  }, [voiceOpenKm, voiceReason]);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: draws, error: drawError } = await supabase
        .from('vehicle_transactions')
        .select(`
          id,
          vehicle_id,
          odometer_reading,
          created_at,
          vehicles!inner(registration_number, make, model)
        `)
        .eq('driver_id', driverId)
        .eq('transaction_type', 'draw')
        .order('created_at', { ascending: false })
        .limit(50);

      if (drawError) throw drawError;

      const allTrips: DrawnTrip[] = [];

      for (const draw of draws || []) {
        const { data: returnData } = await supabase
          .from('vehicle_transactions')
          .select('id, odometer_reading, created_at')
          .eq('related_transaction_id', draw.id)
          .eq('transaction_type', 'return')
          .limit(1)
          .maybeSingle();

        allTrips.push({
          id: draw.id,
          vehicleId: draw.vehicle_id,
          vehicleRegistration: (draw.vehicles as any).registration_number,
          vehicleMake: (draw.vehicles as any).make || '',
          vehicleModel: (draw.vehicles as any).model || '',
          odometerReading: draw.odometer_reading,
          drawnAt: draw.created_at,
          returned: !!returnData,
          returnOdometer: returnData?.odometer_reading ?? null,
        });
      }

      setTrips(allTrips);
    } catch (err: any) {
      setError(err.message || 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async (trip: DrawnTrip) => {
    try {
      const { data, error: entriesError } = await supabase
        .from('trip_logbook_entries')
        .select('*')
        .eq('driver_id', driverId)
        .eq('vehicle_id', trip.vehicleId)
        .order('entry_date', { ascending: true })
        .order('sequence_number', { ascending: true });

      if (entriesError) throw entriesError;

      const enrichedEntries = (data || []).map((e: any) => ({
        ...e,
        vehicle_registration: trip.vehicleRegistration,
        vehicle_make: trip.vehicleMake,
        vehicle_model: trip.vehicleModel,
      }));

      setEntries(enrichedEntries);
    } catch (err: any) {
      setError(err.message || 'Failed to load logbook entries');
    }
  };

  const handleSelectTrip = (trip: DrawnTrip) => {
    setSelectedTrip(trip);
    setEntries([]);
    setError('');
    setSuccessMsg('');
    setShowManualForm(false);
    setVoiceStep('idle');
    loadEntries(trip);
  };

  // --- Voice recognition helpers ---

  const stopRecognition = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // already stopped
      }
      recognitionRef.current = null;
    }
    setVoiceInterim('');
  }, []);

  const speak = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-ZA';
        utterance.rate = 0.9;
        let resolved = false;
        const done = () => { if (!resolved) { resolved = true; resolve(); } };
        utterance.onend = done;
        utterance.onerror = done;
        // Fallback timeout — some mobile browsers never fire onend
        setTimeout(done, text.length * 80 + 2000);
        window.speechSynthesis.speak(utterance);
      } catch {
        resolve();
      }
    });
  };

  // Speak a prompt, then wait a short beat before opening the mic so the
  // device doesn't capture its own speech output.
  const speakThenListen = async (prompt: string, numeric: boolean) => {
    await speak(prompt);
    // Give the audio system a moment to release the speaker before opening the mic
    await new Promise(resolve => setTimeout(resolve, 300));
    startListening(numeric);
  };

  const startListening = (numeric: boolean) => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError('Voice input not supported on this browser');
      return;
    }

    // If already listening, stop instead (toggle behavior)
    if (isListeningRef.current) {
      stopRecognition();
      return;
    }

    stopRecognition();

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-ZA';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    setVoiceInterim('');
    setVoiceError('');
    isListeningRef.current = true;
    setIsListening(true);

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText = transcript.trim();
        } else {
          interimText += transcript;
        }
      }

      setVoiceInterim(interimText);

      if (finalText) {
        const step = voiceStepRef.current;
        if (numeric) {
          const parsed = parseKmFromSpeech(finalText);
          if (parsed) {
            if (step === 'asking_open_km') {
              setVoiceOpenKm(parsed);
            } else if (closingKmEntryIdRef.current) {
              setClosingKmValue(parsed);
            }
          } else {
            setVoiceInterim(`Heard: "${finalText}" — please enter the number manually`);
          }
        } else {
          if (step === 'asking_reason') {
            setVoiceReason(finalText);
          }
        }
        if (!numeric || parseKmFromSpeech(finalText)) {
          setVoiceInterim('');
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setVoiceError('Microphone access denied');
      } else if (event.error === 'no-speech') {
        // ignore — let driver tap Speak again
      } else {
        setVoiceError('Voice error: ' + event.error);
      }
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
      setVoiceInterim('');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      // already started
    }
  };

  // --- Guided voice flow ---

  const startGuidedVoice = async () => {
    if (!selectedTrip) return;
    setVoiceOpenKm('');
    setVoiceReason('');
    confirmingRef.current = false;

    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
    const suggestedOpenKm = lastEntry?.closing_km != null ? lastEntry.closing_km : selectedTrip.odometerReading;

    setVoiceOpenKm(String(suggestedOpenKm));
    setVoiceStep('asking_open_km');
    await speakThenListen('What are the opening kilometers?', true);
  };

  const confirmOpenKm = async () => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    stopRecognition();
    setVoiceStep('asking_reason');
    await speak(`Opening kilometers: ${formatNumber(voiceOpenKm)}.`);
    confirmingRef.current = false;
    await speakThenListen('What is the reason for the trip?', false);
  };

  const confirmReason = async () => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    stopRecognition();
    setVoiceStep('done');
    await saveVoiceEntry();
    confirmingRef.current = false;
  };

  const saveVoiceEntry = async () => {
    if (!selectedTrip || !voiceOpenKm || !voiceReason) return;
    setSaving(true);
    setError('');

    try {
      const openKm = parseInt(voiceOpenKm, 10);

      if (isNaN(openKm)) {
        throw new Error('Invalid opening kilometer value');
      }

      const seqNum = entries.length > 0 ? Math.max(...entries.map(e => e.sequence_number)) + 1 : 1;

      const { data, error: insertError } = await supabase
        .from('trip_logbook_entries')
        .insert({
          vehicle_transaction_id: selectedTrip.id,
          organization_id: organizationId,
          driver_id: driverId,
          vehicle_id: selectedTrip.vehicleId,
          sequence_number: seqNum,
          opening_km: openKm,
          trip_reason: voiceReason.trim(),
          closing_km: null,
          km_travelled: null,
          entry_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newEntry: LogbookEntry = {
        ...data,
        vehicle_registration: selectedTrip.vehicleRegistration,
        vehicle_make: selectedTrip.vehicleMake,
        vehicle_model: selectedTrip.vehicleModel,
      };

      setEntries(prev => [...prev, newEntry]);
      setSuccessMsg('Logbook entry saved. Add closing kilometers later when the trip is complete.');
      setVoiceStep('idle');
      setVoiceOpenKm('');
      setVoiceReason('');

      await speak('Entry saved. You can add closing kilometers later.');
    } catch (err: any) {
      setError(err.message || 'Failed to save logbook entry');
      setVoiceStep('idle');
    } finally {
      setSaving(false);
    }
  };

  const cancelVoice = () => {
    stopRecognition();
    setVoiceStep('idle');
    setVoiceOpenKm('');
    setVoiceReason('');
    setVoiceInterim('');
    setVoiceError('');
    confirmingRef.current = false;
  };

  // --- Add closing km to a pending entry ---
  const [closingKmEntryId, setClosingKmEntryIdState] = useState<string | null>(null);
  const [closingKmValue, setClosingKmValue] = useState('');
  const [closingKmSaving, setClosingKmSaving] = useState(false);

  const setClosingKmEntryId = (id: string | null) => {
    closingKmEntryIdRef.current = id;
    setClosingKmEntryIdState(id);
  };

  const handleAddClosingKm = async () => {
    if (!closingKmEntryId || !closingKmValue) return;
    const closeKm = parseInt(closingKmValue, 10);
    if (isNaN(closeKm)) {
      setError('Invalid closing kilometer value');
      return;
    }

    const entry = entries.find(e => e.id === closingKmEntryId);
    if (entry && closeKm < entry.opening_km) {
      setError('Closing km cannot be less than opening km');
      return;
    }

    setClosingKmSaving(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('trip_logbook_entries')
        .update({
          closing_km: closeKm,
          km_travelled: closeKm - (entry?.opening_km || 0),
          updated_at: new Date().toISOString(),
        })
        .eq('id', closingKmEntryId);

      if (updateError) throw updateError;

      setEntries(prev => prev.map(e =>
        e.id === closingKmEntryId
          ? { ...e, closing_km: closeKm, km_travelled: closeKm - e.opening_km }
          : e
      ));
      setClosingKmEntryId(null);
      setClosingKmValue('');
      setSuccessMsg('Closing kilometers added');
    } catch (err: any) {
      setError(err.message || 'Failed to update closing km');
    } finally {
      setClosingKmSaving(false);
    }
  };

  // --- Manual entry ---

  const handleManualSubmit = async () => {
    if (!selectedTrip) return;
    if (!manualOpenKm || !manualReason.trim()) {
      setError('Open km and reason are required');
      return;
    }

    const openKm = parseInt(manualOpenKm, 10);

    if (isNaN(openKm)) {
      setError('Invalid opening kilometer value');
      return;
    }

    const closeKm = manualCloseKm ? parseInt(manualCloseKm, 10) : null;
    if (closeKm !== null && isNaN(closeKm)) {
      setError('Invalid closing kilometer value');
      return;
    }
    if (closeKm !== null && closeKm < openKm) {
      setError('Closing km cannot be less than opening km');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const seqNum = entries.length > 0 ? Math.max(...entries.map(e => e.sequence_number)) + 1 : 1;

      const { data, error: insertError } = await supabase
        .from('trip_logbook_entries')
        .insert({
          vehicle_transaction_id: selectedTrip.id,
          organization_id: organizationId,
          driver_id: driverId,
          vehicle_id: selectedTrip.vehicleId,
          sequence_number: seqNum,
          opening_km: openKm,
          trip_reason: manualReason.trim(),
          closing_km: closeKm,
          km_travelled: closeKm !== null ? closeKm - openKm : null,
          entry_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newEntry: LogbookEntry = {
        ...data,
        vehicle_registration: selectedTrip.vehicleRegistration,
        vehicle_make: selectedTrip.vehicleMake,
        vehicle_model: selectedTrip.vehicleModel,
      };

      setEntries(prev => [...prev, newEntry]);
      setSuccessMsg('Logbook entry saved successfully');
      setManualOpenKm('');
      setManualReason('');
      setManualCloseKm('');
      setShowManualForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save logbook entry');
    } finally {
      setSaving(false);
    }
  };

  // --- Edit entry ---

  const startEdit = (entry: LogbookEntry) => {
    setEditingId(entry.id);
    setEditOpenKm(String(entry.opening_km));
    setEditReason(entry.trip_reason);
    setEditCloseKm(entry.closing_km != null ? String(entry.closing_km) : '');
  };

  const handleEditSave = async () => {
    if (!editingId) return;

    const openKm = parseInt(editOpenKm, 10);
    const closeKm = editCloseKm ? parseInt(editCloseKm, 10) : null;

    if (isNaN(openKm)) {
      setError('Invalid opening kilometer value');
      return;
    }
    if (closeKm !== null && isNaN(closeKm)) {
      setError('Invalid closing kilometer value');
      return;
    }
    if (closeKm !== null && closeKm < openKm) {
      setError('Closing km cannot be less than opening km');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('trip_logbook_entries')
        .update({
          opening_km: openKm,
          trip_reason: editReason.trim(),
          closing_km: closeKm,
          km_travelled: closeKm !== null ? closeKm - openKm : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);

      if (updateError) throw updateError;

      setEntries(prev => prev.map(e =>
        e.id === editingId
          ? { ...e, opening_km: openKm, trip_reason: editReason.trim(), closing_km: closeKm, km_travelled: closeKm !== null ? closeKm - openKm : null }
          : e
      ));
      setEditingId(null);
      setSuccessMsg('Entry updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to update entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm('Delete this logbook entry?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('trip_logbook_entries')
        .delete()
        .eq('id', entryId);

      if (deleteError) throw deleteError;

      setEntries(prev => prev.filter(e => e.id !== entryId));
      setSuccessMsg('Entry deleted');
    } catch (err: any) {
      setError(err.message || 'Failed to delete entry');
    }
  };

  // --- Export ---

  const exportCSV = () => {
    if (!entries.length || !selectedTrip) return;

    let csv = `SARS Logbook - ${selectedTrip.vehicleRegistration}\nDriver: ${driverName}\nDate: ${new Date().toLocaleDateString('en-ZA')}\n\n`;
    csv += 'Date,Open km,Reason,Closing km,KM Travelled\n';

    let totalKm = 0;
    for (const e of entries) {
      const safe = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
      csv += `${e.entry_date},${e.opening_km},${safe(e.trip_reason)},${e.closing_km},${e.km_travelled}\n`;
      totalKm += e.km_travelled;
    }
    csv += `\n,,Total,${totalKm}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logbook-${selectedTrip.vehicleRegistration}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatNumber = (val: string) => {
    const n = parseInt(val, 10);
    return isNaN(n) ? val : n.toLocaleString();
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalKm = entries.reduce((sum, e) => sum + (e.km_travelled || 0), 0);

  // --- Cleanup speech synthesis on unmount ---
  useEffect(() => {
    return () => {
      stopRecognition();
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    };
  }, [stopRecognition]);

  // --- Trip selection screen ---

  if (!selectedTrip) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="hover:bg-blue-700 p-2 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold">SARS Logbook</h1>
              <p className="text-sm text-blue-100">Select a trip to record logbook entries</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-2xl mx-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">Loading trips...</p>
            </div>
          ) : trips.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No trips found</p>
              <p className="text-sm text-gray-400 mt-1">Draw a vehicle first to start recording logbook entries.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => handleSelectTrip(trip)}
                  className="w-full bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${trip.returned ? 'bg-gray-100' : 'bg-teal-100'}`}>
                        <Car className={`w-6 h-6 ${trip.returned ? 'text-gray-500' : 'text-teal-600'}`} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-lg">{trip.vehicleRegistration}</p>
                        <p className="text-sm text-gray-600">{trip.vehicleMake} {trip.vehicleModel}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Drawn: {formatTime(trip.drawnAt)} — Start: {trip.odometerReading.toLocaleString()} km
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {trip.returned ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          <CheckCircle className="w-3 h-3" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Logbook entry screen for selected trip ---

  const isListeningNow = isListening;
  const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const suggestedOpenKm = lastEntry?.closing_km != null ? lastEntry.closing_km : selectedTrip.odometerReading;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => { stopRecognition(); setSelectedTrip(null); }} className="hover:bg-blue-700 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Logbook — {selectedTrip.vehicleRegistration}</h1>
            <p className="text-sm text-blue-100">{selectedTrip.vehicleMake} {selectedTrip.vehicleModel}</p>
          </div>
          {entries.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 text-sm">{successMsg}</p>
          </div>
        )}

        {/* Guided Voice Entry */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Mic className="w-5 h-5 text-blue-600" />
            Voice Guided Entry
          </h2>

          {voiceStep === 'idle' ? (
            <button
              onClick={startGuidedVoice}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-lg"
            >
              <Mic className="w-6 h-6" />
              Start Voice Entry
            </button>
          ) : (
            <div className="space-y-4">
              {/* Step indicator */}
              <div className="flex items-center gap-2 text-sm">
                <span className={`px-3 py-1 rounded-full font-medium ${voiceStep === 'asking_open_km' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  1. Open km
                </span>
                <span className={`px-3 py-1 rounded-full font-medium ${voiceStep === 'asking_reason' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  2. Reason
                </span>
                <span className={`px-3 py-1 rounded-full font-medium ${voiceStep === 'done' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  Save
                </span>
              </div>

              {/* Open km */}
              {voiceStep === 'asking_open_km' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opening Kilometers</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={voiceOpenKm}
                      onChange={(e) => setVoiceOpenKm(e.target.value)}
                      className="flex-1 border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
                      placeholder="e.g. 12345"
                      style={{ fontSize: '16px' }}
                    />
                    <button
                      onClick={() => startListening(true)}
                      className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                        isListeningNow ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      {isListeningNow ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      {isListeningNow ? 'Stop' : 'Speak'}
                    </button>
                  </div>
                  {voiceInterim && voiceStep === 'asking_open_km' && (
                    <p className="text-xs text-gray-500 mt-1">Hearing: "{voiceInterim}"</p>
                  )}
                  {voiceError && <p className="text-xs text-red-500 mt-1">{voiceError}</p>}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={confirmOpenKm}
                      disabled={!voiceOpenKm || saving}
                      className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Confirm Open km
                    </button>
                    <button
                      onClick={cancelVoice}
                      className="px-6 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Reason */}
              {voiceStep === 'asking_reason' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Trip</label>
                  <div className="flex gap-2">
                    <textarea
                      value={voiceReason}
                      onChange={(e) => setVoiceReason(e.target.value)}
                      className="flex-1 border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
                      placeholder="e.g. Delivery to client in Cape Town"
                      style={{ fontSize: '16px', minHeight: '80px' }}
                      rows={3}
                    />
                    <button
                      onClick={() => startListening(false)}
                      className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 self-start ${
                        isListeningNow ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      {isListeningNow ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      {isListeningNow ? 'Stop' : 'Speak'}
                    </button>
                  </div>
                  {voiceInterim && (
                    <p className="text-xs text-gray-500 mt-1">Hearing: "{voiceInterim}"</p>
                  )}
                  {voiceError && <p className="text-xs text-red-500 mt-1">{voiceError}</p>}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={confirmReason}
                      disabled={!voiceReason.trim() || saving}
                      className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                    >
                      {saving ? 'Saving...' : (<><Check className="w-5 h-5" /> Save Entry</>)}
                    </button>
                    <button
                      onClick={cancelVoice}
                      className="px-6 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Done */}
              {voiceStep === 'done' && (
                <div className="text-center py-4">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <p className="text-gray-700 font-medium">
                    {saving ? 'Saving...' : 'Entry saved! Closing km can be added later.'}
                  </p>
                  {!saving && (
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={startGuidedVoice}
                        className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Add Another Leg
                      </button>
                      <button
                        onClick={() => setVoiceStep('idle')}
                        className="px-6 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual entry toggle */}
        {voiceStep === 'idle' && !showManualForm && (
          <button
            onClick={() => {
              setShowManualForm(true);
              setManualOpenKm(String(suggestedOpenKm));
            }}
            className="w-full bg-white border-2 border-dashed border-gray-300 rounded-lg py-3 mb-4 text-gray-600 font-medium hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Entry Manually
          </button>
        )}

        {/* Manual entry form */}
        {showManualForm && voiceStep === 'idle' && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Manual Entry</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Kilometers</label>
                <input
                  type="number"
                  value={manualOpenKm}
                  onChange={(e) => setManualOpenKm(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. 12345"
                  style={{ fontSize: '16px' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Trip</label>
                <textarea
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Delivery to client in Cape Town"
                  style={{ fontSize: '16px', minHeight: '80px' }}
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Closing Kilometers <span className="text-gray-400 font-normal">(optional — add later if unknown)</span></label>
                <input
                  type="number"
                  value={manualCloseKm}
                  onChange={(e) => setManualCloseKm(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
                  placeholder="Leave blank to add later"
                  style={{ fontSize: '16px' }}
                />
                {manualOpenKm && manualCloseKm && (
                  <p className="text-xs text-blue-600 mt-1">
                    Distance: {Math.max(0, parseInt(manualCloseKm || '0', 10) - parseInt(manualOpenKm || '0', 10)).toLocaleString()} km
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleManualSubmit}
                  disabled={saving}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Entry'}
                </button>
                <button
                  onClick={() => { setShowManualForm(false); setManualOpenKm(''); setManualReason(''); setManualCloseKm(''); }}
                  className="px-6 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inline closing km form for pending entries */}
        {closingKmEntryId && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4">
            <h3 className="font-bold text-teal-900 mb-2">Add Closing Kilometers</h3>
            {(() => {
              const pendingEntry = entries.find(e => e.id === closingKmEntryId);
              if (!pendingEntry) return null;
              return (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Open km: <span className="font-mono font-medium">{pendingEntry.opening_km.toLocaleString()}</span> — {pendingEntry.trip_reason}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={closingKmValue}
                      onChange={(e) => setClosingKmValue(e.target.value)}
                      className="flex-1 border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:border-teal-500 focus:outline-none"
                      placeholder="Closing km reading"
                      style={{ fontSize: '16px' }}
                      autoFocus
                    />
                    <button
                      onClick={() => startListening(true)}
                      className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                        isListeningNow ? 'bg-red-100 text-red-700' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                      }`}
                    >
                      {isListeningNow ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      {isListeningNow ? 'Stop' : 'Speak'}
                    </button>
                  </div>
                  {voiceInterim && (
                    <p className="text-xs text-gray-500">Hearing: "{voiceInterim}"</p>
                  )}
                  {closingKmValue && (
                    <p className="text-xs text-teal-700 font-medium">
                      Distance: {Math.max(0, parseInt(closingKmValue || '0', 10) - pendingEntry.opening_km).toLocaleString()} km
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleAddClosingKm}
                      disabled={!closingKmValue || closingKmSaving}
                      className="flex-1 bg-teal-600 text-white py-3 rounded-lg font-semibold hover:bg-teal-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                    >
                      {closingKmSaving ? 'Saving...' : (<><Check className="w-5 h-5" /> Save Closing km</>)}
                    </button>
                    <button
                      onClick={() => { setClosingKmEntryId(null); setClosingKmValue(''); stopRecognition(); }}
                      className="px-6 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Entries table */}
        {entries.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="font-bold text-gray-900">Logbook Entries</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'} — Total: {totalKm.toLocaleString()} km
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Open km</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Close km</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">KM</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      {editingId === entry.id ? (
                        <>
                          <td className="px-3 py-2 text-sm text-gray-700">{entry.entry_date}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={editOpenKm}
                              onChange={(e) => setEditOpenKm(e.target.value)}
                              className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={editCloseKm}
                              onChange={(e) => setEditCloseKm(e.target.value)}
                              className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-2 text-sm text-blue-700 font-medium">
                            {(parseInt(editCloseKm || '0', 10) - parseInt(editOpenKm || '0', 10)).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button
                                onClick={handleEditSave}
                                disabled={saving}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-sm text-gray-700">{entry.entry_date}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 text-right font-mono">{entry.opening_km.toLocaleString()}</td>
                          <td className="px-3 py-2 text-sm text-gray-800">{entry.trip_reason}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 text-right font-mono">{entry.closing_km != null ? entry.closing_km.toLocaleString() : <span className="text-gray-400 italic">—</span>}</td>
                          <td className="px-3 py-2 text-sm text-blue-700 text-right font-medium">{entry.km_travelled != null ? entry.km_travelled.toLocaleString() : <span className="text-gray-400 italic">—</span>}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              {entry.closing_km == null && closingKmEntryId !== entry.id && (
                                <button
                                  onClick={() => { setClosingKmEntryId(entry.id); setClosingKmValue(''); }}
                                  className="text-xs font-medium text-teal-600 hover:text-teal-700 px-2 py-1 rounded hover:bg-teal-50 transition-colors whitespace-nowrap"
                                >
                                  + Close km
                                </button>
                              )}
                              <button
                                onClick={() => startEdit(entry)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={4} className="px-3 py-3 text-sm text-gray-900 text-right">Total KM Travelled:</td>
                    <td className="px-3 py-3 text-sm text-blue-700 text-right">{totalKm.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {entries.length === 0 && voiceStep === 'idle' && !showManualForm && !closingKmEntryId && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No logbook entries yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Use voice guided entry or manual entry to add your first trip leg.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
