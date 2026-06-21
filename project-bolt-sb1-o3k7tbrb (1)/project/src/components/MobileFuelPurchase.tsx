import { useState, useEffect } from 'react';
import { Fuel, Camera, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
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

interface Garage {
  id: string;
  name: string;
  address: string;
  commission_rate: number;
  fuel_prices?: Record<string, number>;
}

interface ScanData {
  image: string;
  extractedText: string;
}

export default function MobileFuelPurchase() {
  const [step, setStep] = useState<'scan-license' | 'fill-details' | 'confirm'>('scan-license');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [licenseDiskScan, setLicenseDiskScan] = useState<ScanData | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [extractedVin, setExtractedVin] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fuelEfficiency, setFuelEfficiency] = useState<number | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [formData, setFormData] = useState({
    liters: '',
    pricePerLiter: '',
    totalAmount: '',
    odometerReading: '',
    garageId: '',
  });

  const [garages, setGarages] = useState<Garage[]>([]);

  useEffect(() => {
    loadVehicles();
    loadGarages();
    getCurrentLocation();
  }, []);

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profile) {
      const { data } = await supabase
        .from('vehicles')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'active')
        .order('registration_number');

      if (data) setVehicles(data);
    }
  };

  const loadGarages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profile) {
      const { data } = await supabase
        .from('garages')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'active')
        .order('name');

      if (data) setGarages(data);
    }
  };


  const handleScanStart = () => {
    setShowBarcodeScanner(true);
  };

  const handleBarcodeScan = async (barcodeData: string) => {
    setLicenseDiskScan({ image: '', extractedText: barcodeData });
    setShowBarcodeScanner(false);

    const result = await findVehicleByLicenseDisk(barcodeData);
    if (!result) {
      setError('License disk verification failed. The barcode data does not match any vehicle.');
      setLicenseDiskScan(null);
      return;
    }

    const { vehicle, vin } = result;
    setSelectedVehicle(vehicle);
    setExtractedVin(vin);
    setStep('fill-details');
  };


  const findVehicleByLicenseDisk = async (barcodeData: string): Promise<{ vehicle: Vehicle; vin: string } | null> => {
    console.log('Raw barcode data:', barcodeData);
    console.log('Available vehicles:', vehicles.map(v => ({ reg: v.registration_number, vin: v.vin_number })));

    const barcodeFields = barcodeData.split('%');
    console.log('Barcode fields:', barcodeFields);

    let extractedVinFromBarcode = '';

    for (let i = 0; i < barcodeFields.length; i++) {
      const field = barcodeFields[i].trim();
      if (field.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/i.test(field)) {
        extractedVinFromBarcode = field.toUpperCase();
        console.log('Extracted VIN from barcode:', extractedVinFromBarcode);
        break;
      }
    }

    for (const vehicle of vehicles) {
      const vehicleReg = vehicle.registration_number.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
      const vehicleVin = vehicle.vin_number?.trim().toUpperCase() || '';
      console.log(`Checking vehicle: ${vehicle.registration_number} (cleaned: ${vehicleReg}, VIN: ${vehicleVin})`);

      for (const field of barcodeFields) {
        const cleanField = field.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
        console.log(`  Comparing field "${cleanField}" with "${vehicleReg}"`);

        if (cleanField && cleanField === vehicleReg) {
          console.log(`✓ Match found! Field "${field}" matches vehicle ${vehicle.registration_number}`);

          const expiryDate = new Date(vehicle.license_disk_expiry);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          expiryDate.setHours(0, 0, 0, 0);

          if (expiryDate < today) {
            setError('Vehicle License Expired');
            return null;
          }

          if (vehicleVin && extractedVinFromBarcode && vehicleVin !== extractedVinFromBarcode) {
            console.log(`VIN mismatch: vehicle VIN "${vehicleVin}" vs barcode VIN "${extractedVinFromBarcode}"`);
            setError(`VIN verification failed. Barcode VIN (${extractedVinFromBarcode}) does not match vehicle VIN (${vehicleVin}).`);
            return null;
          }

          console.log(`✓ Verification passed for ${vehicle.registration_number}`);
          return { vehicle, vin: extractedVinFromBarcode };
        }
      }
    }

    console.log('❌ No matching vehicle found in database.');
    console.log('Barcode contained fields:', barcodeFields.map(f => f.trim()));
    console.log('Available registrations:', vehicles.map(v => v.registration_number));
    return null;
  };


  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    const selectedGarage = garages.find(g => g.id === formData.garageId);
    if (!selectedGarage) {
      setError('Please select a garage.');
      setLoading(false);
      return;
    }

    const totalAmount = parseFloat(formData.totalAmount);
    const commissionRate = selectedGarage.commission_rate;
    const commissionAmount = (totalAmount * commissionRate) / 100;
    const netAmount = totalAmount - commissionAmount;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      // Get the previous odometer reading for this vehicle
      const { data: lastTransaction } = await supabase
        .from('fuel_transactions')
        .select('odometer_reading')
        .eq('vehicle_id', selectedVehicle?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error: insertError } = await supabase
        .from('fuel_transactions')
        .insert({
          organization_id: profile?.organization_id,
          vehicle_id: selectedVehicle?.id,
          garage_id: formData.garageId,
          driver_id: user.id,
          liters: parseFloat(formData.liters),
          price_per_liter: parseFloat(formData.pricePerLiter),
          total_amount: totalAmount,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          net_amount: netAmount,
          previous_odometer_reading: lastTransaction?.odometer_reading || null,
          odometer_reading: parseInt(formData.odometerReading),
          location: location ? `${location.lat},${location.lng}` : 'Unknown',
          fuel_type: selectedVehicle?.fuel_type || 'ULP-95',
          license_disk_image: licenseDiskScan?.image,
          number_plate_image: null,
          verified: true,
          authorized_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      const efficiency = await calculateFuelEfficiency(
        selectedVehicle!.id,
        parseInt(formData.odometerReading),
        parseFloat(formData.liters)
      );
      setFuelEfficiency(efficiency);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit transaction');
    } finally {
      setLoading(false);
    }
  };

  const calculateFuelEfficiency = async (
    vehicleId: string,
    currentOdometer: number,
    litersPurchased: number
  ): Promise<number | null> => {
    try {
      const { data: previousTransaction } = await supabase
        .from('fuel_transactions')
        .select('odometer_reading')
        .eq('vehicle_id', vehicleId)
        .order('authorized_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previousTransaction && previousTransaction.odometer_reading) {
        const kmTravelled = currentOdometer - previousTransaction.odometer_reading;
        if (kmTravelled > 0 && litersPurchased > 0) {
          return kmTravelled / litersPurchased;
        }
      }
    } catch (err) {
      console.error('Error calculating fuel efficiency:', err);
    }
    return null;
  };

  const resetForm = () => {
    setStep('scan-license');
    setSelectedVehicle(null);
    setLicenseDiskScan(null);
    setExtractedVin('');
    setFormData({
      liters: '',
      pricePerLiter: '',
      totalAmount: '',
      odometerReading: '',
      garageId: '',
    });
    setSuccess(false);
    setFuelEfficiency(null);
    setError('');
  };

  useEffect(() => {
    if (formData.liters && formData.pricePerLiter) {
      const total = (parseFloat(formData.liters) * parseFloat(formData.pricePerLiter)).toFixed(2);
      setFormData(prev => ({ ...prev, totalAmount: total }));
    }
  }, [formData.liters, formData.pricePerLiter]);

  useEffect(() => {
    if (formData.garageId && selectedVehicle?.fuel_type) {
      const selectedGarage = garages.find(g => g.id === formData.garageId);
      if (selectedGarage?.fuel_prices) {
        const price = selectedGarage.fuel_prices[selectedVehicle.fuel_type];
        if (price) {
          setFormData(prev => ({ ...prev, pricePerLiter: price.toFixed(2) }));
        }
      }
    }
  }, [formData.garageId, selectedVehicle, garages]);

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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Transaction Authorized!</h2>
          <p className="text-gray-600 mb-6">Fuel purchase authorized. Payment will be processed via daily EFT run.</p>

          {fuelEfficiency !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-blue-900 mb-1">Fuel Efficiency</p>
              <p className="text-3xl font-bold text-blue-600">{fuelEfficiency.toFixed(2)}</p>
              <p className="text-sm text-blue-700">km per liter</p>
              <p className="text-xs text-blue-600 mt-2">Since last refueling</p>
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
          <Fuel className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold">Fuel Purchase</h1>
            <p className="text-sm text-blue-100">Vehicle Authentication</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            {['scan-license', 'fill-details'].map((s, idx) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step === s ? 'bg-blue-600 text-white' :
                    ['scan-license', 'fill-details'].indexOf(step) > idx
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {idx + 1}
                </div>
                {idx < 1 && <div className="flex-1 h-1 bg-gray-300 mx-1"></div>}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {step === 'scan-license' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Scan License Disk Barcode</h2>
            <p className="text-gray-600 mb-6">Scan the barcode on the vehicle's license disk. This will verify both the vehicle registration and VIN number.</p>

            {selectedVehicle && extractedVin && (
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900 font-medium">Vehicle Identified:</p>
                <p className="text-lg font-bold text-blue-900">{selectedVehicle.registration_number}</p>
                <p className="text-sm text-blue-700">{selectedVehicle.make} {selectedVehicle.model}</p>
                <p className="text-xs text-blue-600 mt-2">VIN: {extractedVin}</p>
                <p className="text-xs text-blue-600">License Expires: {new Date(selectedVehicle.license_disk_expiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
            )}

            <button
              onClick={handleScanStart}
              className="w-full bg-blue-600 text-white py-4 rounded-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-colors"
            >
              <Camera className="w-6 h-6" />
              Scan License Disk Barcode
            </button>
          </div>
        )}


        {step === 'fill-details' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Fill Details</h2>

            <div className="bg-green-50 rounded-lg p-4 mb-6">
              <div className="space-y-2">
                <p className="text-sm text-green-900">✓ License Disk Verified</p>
                <p className="text-sm text-green-900">✓ VIN Verified: {extractedVin}</p>
                <p className="text-sm text-green-900">✓ Vehicle: {selectedVehicle?.registration_number}</p>
                <p className="text-sm text-green-900">✓ License Expires: {selectedVehicle && new Date(selectedVehicle.license_disk_expiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
            </div>

            {location && (
              <div className="bg-green-50 rounded-lg p-3 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">Location Captured</p>
                  <p className="text-xs text-green-700">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Garage</label>
                <select
                  value={formData.garageId}
                  onChange={(e) => setFormData({ ...formData, garageId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  required
                >
                  <option value="">Select Garage</option>
                  {garages.map((garage) => (
                    <option key={garage.id} value={garage.id}>
                      {garage.name} - {garage.address}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Liters</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.liters}
                  onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  placeholder="50.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price per Liter (R)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.pricePerLiter}
                  readOnly
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50"
                  placeholder="Select garage to see price"
                />
                {selectedVehicle?.fuel_type && (
                  <p className="text-xs text-gray-500 mt-1">
                    Fuel Type: {selectedVehicle.fuel_type}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (R)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.totalAmount}
                  readOnly
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Odometer Reading (km)</label>
                <input
                  type="number"
                  value={formData.odometerReading}
                  onChange={(e) => setFormData({ ...formData, odometerReading: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  placeholder="125000"
                  required
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !formData.liters || !formData.pricePerLiter || !formData.odometerReading || !formData.garageId}
              className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed mt-6 transition-colors"
            >
              {loading ? 'Processing...' : 'Authorize Transaction'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
