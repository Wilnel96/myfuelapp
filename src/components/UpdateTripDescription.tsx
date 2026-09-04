import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, CheckCircle, AlertCircle, Clock, Car, History } from 'lucide-react';
import VoiceInput from './VoiceInput';
import { supabase } from '../lib/supabase';

interface UpdateTripDescriptionProps {
  organizationId: string;
  driverId: string;
  onBack: () => void;
}

interface Trip {
  id: string;
  vehicleId: string;
  vehicleRegistration: string;
  vehicleMake: string;
  vehicleModel: string;
  odometerReading: number;
  drawnAt: string;
  tripDescription: string | null;
  returned: boolean;
  returnedAt: string | null;
  returnOdometer: number | null;
}

export default function UpdateTripDescription({ organizationId, driverId, onBack }: UpdateTripDescriptionProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

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
          trip_description,
          vehicles!inner(registration_number, make, model)
        `)
        .eq('driver_id', driverId)
        .eq('transaction_type', 'draw')
        .order('created_at', { ascending: false })
        .limit(50);

      if (drawError) throw drawError;

      const allTrips: Trip[] = [];

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
          tripDescription: draw.trip_description,
          returned: !!returnData,
          returnedAt: returnData?.created_at ?? null,
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

  const startEditing = (trip: Trip) => {
    setEditingTripId(trip.id);
    setEditText(trip.tripDescription || '');
    setSuccessMsg('');
  };

  const handleSave = async () => {
    if (!editingTripId) return;
    setSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('vehicle_transactions')
        .update({ trip_description: editText.trim() || null })
        .eq('id', editingTripId);

      if (updateError) throw updateError;

      setSuccessMsg('Trip notes updated successfully');
      setTrips(prev => prev.map(t =>
        t.id === editingTripId ? { ...t, tripDescription: editText.trim() || null } : t
      ));
      setEditingTripId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update trip notes');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const activeTrips = trips.filter(t => !t.returned);
  const historyTrips = trips.filter(t => t.returned);
  const visibleTrips = activeTab === 'active' ? activeTrips : historyTrips;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="hover:bg-blue-700 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Trip Notes</h1>
            <p className="text-sm text-blue-100">Update trip descriptions for active and completed trips</p>
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

        {successMsg && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 text-sm">{successMsg}</p>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setActiveTab('active'); setEditingTripId(null); }}
            className={`flex-1 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'active'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Car className="w-5 h-5" />
            Active Trips
            {activeTrips.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'active' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'
              }`}>
                {activeTrips.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('history'); setEditingTripId(null); }}
            className={`flex-1 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <History className="w-5 h-5" />
            Trip History
            {historyTrips.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'history' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {historyTrips.length}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Loading trips...</p>
          </div>
        ) : visibleTrips.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {activeTab === 'active' ? 'No active trips' : 'No trip history'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {activeTab === 'active'
                ? 'Draw a vehicle first to add trip notes.'
                : 'Completed trips will appear here after you return a vehicle.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleTrips.map((trip) => (
              <div key={trip.id} className={`bg-white rounded-lg shadow overflow-hidden ${trip.returned ? 'border-l-4 border-gray-300' : 'border-l-4 border-teal-500'}`}>
                <div className={`px-4 py-3 border-b ${trip.returned ? 'bg-gray-50 border-gray-200' : 'bg-teal-50 border-teal-100'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900 text-lg">{trip.vehicleRegistration}</p>
                      <p className="text-sm text-gray-600">{trip.vehicleMake} {trip.vehicleModel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {formatTime(trip.drawnAt)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Start: {trip.odometerReading.toLocaleString()} km
                      </p>
                      {trip.returned && trip.returnedAt && (
                        <>
                          <p className="text-xs text-gray-500 mt-1">
                            Returned: {formatTime(trip.returnedAt)}
                          </p>
                          {trip.returnOdometer != null && (
                            <p className="text-xs text-gray-500">
                              End: {trip.returnOdometer.toLocaleString()} km
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {trip.returned && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        <CheckCircle className="w-3 h-3" />
                        Trip Completed
                      </span>
                    </div>
                  )}
                </div>

                {editingTripId === trip.id ? (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Trip Notes</label>
                      <VoiceInput value={editText} onChange={setEditText} />
                    </div>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      style={{ fontSize: '16px', minHeight: '100px' }}
                      placeholder="Describe your trip destinations and purpose. Tap Speak to add by voice."
                      rows={4}
                      maxLength={1000}
                    />
                    <p className="text-xs text-gray-500 mt-1 text-right">{editText.length}/1000 characters</p>
                    <p className="text-xs text-blue-600 mt-2">
                      New spoken text will be added to the end of the existing notes.
                    </p>

                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 transition-colors"
                      >
                        {saving ? 'Saving...' : 'Save Notes'}
                      </button>
                      <button
                        onClick={() => { setEditingTripId(null); setEditText(''); }}
                        className="px-6 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Trip Notes
                      </p>
                      {trip.tripDescription ? (
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{trip.tripDescription}</p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No notes added yet</p>
                      )}
                    </div>

                    <button
                      onClick={() => startEditing(trip)}
                      className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                        trip.returned
                          ? 'bg-gray-600 text-white hover:bg-gray-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <MapPin className="w-5 h-5" />
                      {trip.tripDescription ? 'Edit Trip Notes' : 'Add Trip Notes'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
