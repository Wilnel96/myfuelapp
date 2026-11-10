import { useEffect, useState } from 'react';
import { X, Route, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface MissingTripException {
  id: string;
  organization_id: string;
  driver_id: string | null;
  date: string;
  vehicle: string;
  expected_value: string | null;
  actual_value: string | null;
}

interface LogMissingTripModalProps {
  exception: MissingTripException;
  onClose: () => void;
  onLogged: () => void;
}

interface DriverOption {
  id: string;
  first_name: string;
  surname: string;
}

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

const toLocalDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

export default function LogMissingTripModal({ exception, onClose, onLogged }: LogMissingTripModalProps) {
  const openingKm = Number(exception.expected_value);
  const closingKm = Number(exception.actual_value);
  const kmTravelled = closingKm - openingKm;

  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [driverId, setDriverId] = useState(exception.driver_id ?? '');
  const [entryDate, setEntryDate] = useState(toLocalDate(exception.date));
  const [tripType, setTripType] = useState<'business' | 'private'>('business');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [tripReason, setTripReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error: driversError } = await supabase
        .from('drivers')
        .select('id, first_name, surname')
        .eq('organization_id', exception.organization_id)
        .order('first_name', { ascending: true });

      if (driversError) {
        setError('Could not load the drivers. Please close and try again.');
        return;
      }
      setDrivers(data ?? []);
    })();
  }, [exception.organization_id]);

  const canSubmit =
    !submitting &&
    driverId !== '' &&
    entryDate !== '' &&
    fromLocation.trim() !== '' &&
    toLocation.trim() !== '' &&
    tripReason.trim() !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError('');

    const { data, error: invokeError } = await supabase.functions.invoke('log-missing-trip', {
      body: {
        exception_id: exception.id,
        driver_id: driverId,
        entry_date: entryDate,
        trip_type: tripType,
        from_location: fromLocation,
        to_location: toLocation,
        trip_reason: tripReason,
      },
    });

    if (invokeError || !data?.success) {
      let message = data?.error;
      if (!message && invokeError) {
        try {
          const payload = await (invokeError as { context?: Response }).context?.json();
          message = payload?.error;
        } catch {
          message = undefined;
        }
      }
      setError(message || 'The missing trip could not be logged. Please try again.');
      setSubmitting(false);
      return;
    }

    onLogged();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Route className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Log Missing Trip</h3>
              <p className="text-sm text-gray-600 mt-1">{exception.vehicle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 border border-gray-200 p-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Opening km</p>
              <p className="text-base font-semibold text-gray-900 mt-1">{openingKm.toLocaleString('en-GB')}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Closing km</p>
              <p className="text-base font-semibold text-gray-900 mt-1">{closingKm.toLocaleString('en-GB')}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Km travelled</p>
              <p className="text-base font-semibold text-blue-700 mt-1">{kmTravelled.toLocaleString('en-GB')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="missing-trip-date" className="block text-sm font-medium text-gray-700 mb-1">Trip date</label>
              <input
                id="missing-trip-date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="missing-trip-driver" className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
              <select
                id="missing-trip-driver"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className={inputClass}
                required
              >
                <option value="" disabled>Select a driver</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.first_name} {d.surname}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Trip type</p>
            <div className="grid grid-cols-2 gap-3">
              {(['business', 'private'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={tripType === type}
                  onClick={() => setTripType(type)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                    tripType === type
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="missing-trip-from" className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                id="missing-trip-from"
                type="text"
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                maxLength={200}
                placeholder="Starting location"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="missing-trip-to" className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                id="missing-trip-to"
                type="text"
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                maxLength={200}
                placeholder="Destination"
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="missing-trip-reason" className="block text-sm font-medium text-gray-700 mb-1">Reason for trip</label>
            <textarea
              id="missing-trip-reason"
              value={tripReason}
              onChange={(e) => setTripReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Why the vehicle was used"
              className={`${inputClass} resize-none`}
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {submitting ? 'Logging trip...' : 'Log Trip and Resolve'}
          </button>
        </div>
      </form>
    </div>
  );
}
