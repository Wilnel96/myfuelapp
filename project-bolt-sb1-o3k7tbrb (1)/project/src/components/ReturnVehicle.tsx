import { useState, useEffect } from 'react';
import { Camera, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { supabase } from '../lib/supabase';

interface Vehicle {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  license_disk_expiry: string;
  vin_number?: string;
}

interface DrawTransaction {
  id: string;
  vehicle_id: string;
  odometer_reading: number;
  created_at: string;
}

interface ReturnVehicleProps {
  organizationId: string;
  driverId: string;
  onBack: () => void;
  drawnVehicleId?: string;
}

export default function ReturnVehicle({ organizationId, driverId, onBack, drawnVehicleId }: ReturnVehicleProps) {
  const [step, setStep] = useState<'scan' | 'enter-odometer'>(drawnVehicleId ? 'enter-odometer' : 'scan');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [drawTransaction, setDrawTransaction] = useState<DrawTransaction | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [odometerReading, setOdometerReading] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [kmDriven, setKmDriven] = useState<number | null>(null);

  useEffect(() => {
    loadVehicles();
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (drawnVehicleId) {
      autoLoadDrawnVehicle(drawnVehicleId);
    }
  }, [drawnVehicleId]);

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Location error:', error);
        }
      );
    }
  };

  const loadVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('registration_number');

    if (data) setVehicles(data);
  };

  const autoLoadDrawnVehicle = async (vehicleId: string) => {
    setLoading(true);
    setError('');

    try {
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', vehicleId)
        .maybeSingle();

      if (vehicleError) throw vehicleError;
      if (!vehicle) {
        setError('Drawn vehicle not found');
        setStep('scan');
        return;
      }

      const drawTx = await getActiveDrawing(vehicleId, driverId);
      if (!drawTx) {
        setError('No active drawing found for this vehicle');
        setStep('scan');
        return;
      }

      setSelectedVehicle(vehicle);
      setDrawTransaction(drawTx);
      setStep('enter-odometer');
    } catch (err: any) {
      console.error('Error loading drawn vehicle:', err);
      setError(err.message || 'Failed to load drawn vehicle');
      setStep('scan');
    } finally {
      setLoading(false);
    }
  };

  const handleScanStart = () => {
    setShowBarcodeScanner(true);
  };

  const handleBarcodeScan = async (barcodeData: string) => {
    setShowBarcodeScanner(false);
    setError('');

    const result = await findVehicleByLicenseDisk(barcodeData);
    if (!result) {
      setError('License disk verification failed. The barcode data does not match any vehicle.');
      return;
    }

    const { vehicle } = result;

    const drawTx = await getActiveDrawing(vehicle.id, driverId);
    if (!drawTx) {
      setError('No active vehicle drawing found. Please draw the vehicle first before returning.');
      return;
    }

    setSelectedVehicle(vehicle);
    setDrawTransaction(drawTx);
    setStep('enter-odometer');
  };

  const getActiveDrawing = async (vehicleId: string, driverId: string): Promise<DrawTransaction | null> => {
    const { data: drawTransactions } = await supabase
      .from('vehicle_transactions')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('driver_id', driverId)
      .eq('transaction_type', 'draw')
      .is('related_transaction_id', null)
      .order('created_at', { ascending: false });

    if (!drawTransactions || drawTransactions.length === 0) return null;

    for (const draw of drawTransactions) {
      const { data: returnTransaction } = await supabase
        .from('vehicle_transactions')
        .select('id')
        .eq('related_transaction_id', draw.id)
        .eq('transaction_type', 'return')
        .maybeSingle();

      if (!returnTransaction) {
        return draw;
      }
    }

    return null;
  };

  const findVehicleByLicenseDisk = async (barcodeData: string): Promise<{ vehicle: Vehicle } | null> => {
    const barcodeFields = barcodeData.split('%');

    for (const vehicle of vehicles) {
      const vehicleReg = vehicle.registration_number.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');

      for (const field of barcodeFields) {
        const cleanField = field.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');

        if (cleanField && cleanField === vehicleReg) {
          const expiryDate = new Date(vehicle.license_disk_expiry);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          expiryDate.setHours(0, 0, 0, 0);

          if (expiryDate < today) {
            setError('Vehicle License Expired');
            return null;
          }

          return { vehicle };
        }
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!odometerReading || !selectedVehicle || !drawTransaction) return;

    const returnOdometer = parseInt(odometerReading);

    setError('');
    setLoading(true);

    try {
      const { data: returnTx, error: insertError } = await supabase
        .from('vehicle_transactions')
        .insert({
          organization_id: organizationId,
          vehicle_id: selectedVehicle.id,
          driver_id: driverId,
          transaction_type: 'return',
          odometer_reading: returnOdometer,
          location: location ? `${location.lat},${location.lng}` : 'Unknown',
          related_transaction_id: drawTransaction.id,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const kmDrivenValue = returnOdometer - drawTransaction.odometer_reading;

      const drawTime = new Date(drawTransaction.created_at);
      const returnTime = new Date();
      const hoursElapsed = (returnTime.getTime() - drawTime.getTime()) / (1000 * 60 * 60);

      let shouldLogException = false;
      let exceptionDescription = '';
      let exceptionType = '';

      // Check for odometer going backward
      if (returnOdometer < drawTransaction.odometer_reading) {
        shouldLogException = true;
        exceptionType = 'odometer_decreased';
        exceptionDescription = `Critical: Closing odometer (${returnOdometer.toLocaleString()} km) is less than opening odometer (${drawTransaction.odometer_reading.toLocaleString()} km). Decrease of ${Math.abs(kmDrivenValue).toLocaleString()} km. This indicates either incorrect readings, odometer tampering, or odometer rollback.`;
      } else if (kmDrivenValue > 500 && hoursElapsed < 1) {
        shouldLogException = true;
        exceptionType = 'excessive_km_short_time';
        exceptionDescription = `Suspicious: ${kmDrivenValue} km driven in ${hoursElapsed.toFixed(1)} hours (over 500 km in under 1 hour). This suggests either incorrect odometer readings or unauthorized vehicle use.`;
      } else if (kmDrivenValue < 5 && hoursElapsed > 8) {
        shouldLogException = true;
        exceptionType = 'minimal_km_long_time';
        exceptionDescription = `Suspicious: Only ${kmDrivenValue} km driven in ${hoursElapsed.toFixed(1)} hours (less than 5 km in over 8 hours). Vehicle may have been used without proper tracking.`;
      } else if (kmDrivenValue === 0 && hoursElapsed > 1) {
        shouldLogException = true;
        exceptionType = 'no_km_driven';
        exceptionDescription = `Suspicious: Vehicle was drawn for ${hoursElapsed.toFixed(1)} hours but no kilometers were driven (odometer unchanged at ${drawTransaction.odometer_reading} km). This may indicate unauthorized use or incorrect readings.`;
      } else if (hoursElapsed > 24 && kmDrivenValue > 1000) {
        shouldLogException = true;
        exceptionType = 'excessive_km_extended_period';
        exceptionDescription = `Alert: ${kmDrivenValue} km driven over ${hoursElapsed.toFixed(1)} hours (${(hoursElapsed / 24).toFixed(1)} days). This exceeds typical usage patterns and should be verified.`;
      }

      if (shouldLogException) {
        const { error: exceptionError } = await supabase
          .from('vehicle_exceptions')
          .insert({
            vehicle_id: selectedVehicle.id,
            driver_id: driverId,
            organization_id: organizationId,
            exception_type: exceptionType,
            description: exceptionDescription,
            expected_value: returnOdometer < drawTransaction.odometer_reading
              ? `Odometer should increase or stay the same (was ${drawTransaction.odometer_reading.toLocaleString()} km)`
              : `Normal usage: ${(hoursElapsed * 60).toFixed(0)} minutes should result in reasonable km`,
            actual_value: returnOdometer < drawTransaction.odometer_reading
              ? `Decreased to ${returnOdometer.toLocaleString()} km (${kmDrivenValue} km decrease)`
              : `${kmDrivenValue} km in ${hoursElapsed.toFixed(1)} hours`,
            transaction_id: returnTx.id,
            resolved: false,
          });

        if (exceptionError) {
          console.error('Failed to log vehicle exception:', exceptionError);
        }
      }

      setKmDriven(kmDrivenValue);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to return vehicle');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('scan');
    setSelectedVehicle(null);
    setDrawTransaction(null);
    setOdometerReading('');
    setNotes('');
    setSuccess(false);
    setKmDriven(null);
    setError('');
    onBack();
  };

  if (showBarcodeScanner) {
    return (
      <BarcodeScanner
        label="Scan License Disk Barcode"
        onScan={handleBarcodeScan}
        onCancel={() => setShowBarcodeScanner(false)}
      />
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md w-full">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Vehicle Returned Successfully!</h2>
          <p className="text-gray-600 mb-2">Vehicle: {selectedVehicle?.registration_number}</p>
          <p className="text-gray-600 mb-2">Closing Odometer: {parseInt(odometerReading).toLocaleString()} km</p>
          {kmDriven !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 mb-6">
              <p className="text-sm font-medium text-blue-900 mb-1">Distance Driven</p>
              <p className="text-3xl font-bold text-blue-600">{kmDriven.toLocaleString()}</p>
              <p className="text-sm text-blue-700">kilometers</p>
            </div>
          )}
          <button
            onClick={resetForm}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="hover:bg-blue-700 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Return Vehicle</h1>
            <p className="text-sm text-blue-100">Check In a Vehicle</p>
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

        {step === 'scan' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Vehicle</h2>
            <p className="text-gray-600 mb-6">Scan the license disk barcode or manually select a vehicle.</p>

            {selectedVehicle && (
              <div className="bg-green-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-900 font-medium">Vehicle Selected:</p>
                <p className="text-lg font-bold text-green-900">{selectedVehicle.registration_number}</p>
                <p className="text-sm text-green-700">{selectedVehicle.make} {selectedVehicle.model}</p>
                <p className="text-xs text-green-600 mt-2">
                  License Expires: {new Date(selectedVehicle.license_disk_expiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Manual Selection</label>
                <select
                  value={selectedVehicle?.id || ''}
                  onChange={async (e) => {
                    const vehicle = vehicles.find(v => v.id === e.target.value);
                    if (vehicle) {
                      setError('');
                      const drawTx = await getActiveDrawing(vehicle.id, driverId);
                      if (!drawTx) {
                        setError('No active vehicle drawing found. Please draw the vehicle first before returning.');
                        return;
                      }
                      setSelectedVehicle(vehicle);
                      setDrawTransaction(drawTx);
                    }
                  }}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-4 text-base bg-white appearance-none cursor-pointer focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  style={{ fontSize: '16px', minHeight: '50px' }}
                >
                  <option value="">Select Vehicle by Registration</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registration_number} - {vehicle.make} {vehicle.model}
                    </option>
                  ))}
                </select>
              </div>

              {selectedVehicle && drawTransaction && (
                <button
                  onClick={() => setStep('enter-odometer')}
                  className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                  Continue to Odometer Reading
                </button>
              )}

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              <button
                onClick={handleScanStart}
                className="w-full bg-blue-600 text-white py-4 rounded-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-colors"
              >
                <Camera className="w-6 h-6" />
                Scan License Disk Barcode
              </button>
            </div>
          </div>
        )}

        {step === 'enter-odometer' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Enter Closing Odometer Reading</h2>

            <div className="bg-green-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-900 font-medium">Vehicle:</p>
              <p className="text-lg font-bold text-green-900">{selectedVehicle?.registration_number}</p>
              <p className="text-sm text-green-700">{selectedVehicle?.make} {selectedVehicle?.model}</p>
              <p className="text-xs text-green-600 mt-2">
                License Expires: {selectedVehicle && new Date(selectedVehicle.license_disk_expiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-900">Opening Odometer Reading</p>
              <p className="text-2xl font-bold text-blue-900">{drawTransaction?.odometer_reading.toLocaleString()} km</p>
              <p className="text-xs text-blue-600 mt-1">
                Drawn on: {drawTransaction && new Date(drawTransaction.created_at).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Closing Odometer Reading (km)</label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={odometerReading}
                onChange={(e) => setOdometerReading(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-4 text-lg bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                style={{ fontSize: '16px', minHeight: '50px' }}
                placeholder="125500"
                required
              />
              {odometerReading && drawTransaction && (
                <>
                  {parseInt(odometerReading) >= drawTransaction.odometer_reading ? (
                    <p className="text-sm text-green-600 mt-2">
                      Distance driven: {(parseInt(odometerReading) - drawTransaction.odometer_reading).toLocaleString()} km
                    </p>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mt-2">
                      <p className="text-sm text-yellow-900 font-medium">Warning: Odometer Decreased</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        The closing odometer ({parseInt(odometerReading).toLocaleString()} km) is less than the opening odometer ({drawTransaction.odometer_reading.toLocaleString()} km).
                        This will be logged as an exception for review.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
                <span className="text-gray-500 font-normal ml-1">(Optional)</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Add notes about the vehicle condition, trip details, or any issues encountered
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                style={{ fontSize: '16px', minHeight: '100px' }}
                placeholder="e.g., Vehicle brakes need attention, Completed delivery to Cape Town, Low tire pressure warning light on..."
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-gray-500 mt-1 text-right">{notes.length}/1000 characters</p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !odometerReading}
              className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Processing...' : 'Confirm Return Vehicle'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
