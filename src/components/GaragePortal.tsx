import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getFuelTypeDisplayName, sortFuelTypes, AVAILABLE_FUEL_TYPES } from '../lib/fuelTypes';
import { Store, LogOut, Save, MapPin, AlertCircle, X, Plus, Trash2, Building2, Users, User, Fuel, ShoppingBag, Home, ArrowLeft, Receipt, FileText, CreditCard, Printer } from 'lucide-react';
import GarageContactManagement from './GarageContactManagement';
import GarageLocalAccounts from './GarageLocalAccounts';
import GarageClientIntakeForm from './GarageClientIntakeForm';

interface GaragePortalProps {
  garageId: string;
  garageName: string;
  garageEmail: string;
  garagePassword: string;
  onLogout: () => void;
}

interface OtherOfferings {
  convenience_shop?: boolean;
  branded_convenience_store?: { enabled: boolean; name: string };
  takeaways?: boolean;
  branded_takeaways?: { enabled: boolean; name: string };
  specialty_offering?: { enabled: boolean; name: string };
  lpg_gas?: boolean;
  paraffin?: boolean;
  other?: { enabled: boolean; name: string };
}

interface ContactPerson {
  name: string;
  surname: string;
  email: string;
  phone: string;
  mobile_phone: string;
  is_primary: boolean;
}

interface GarageData {
  id: string;
  name: string;
  address_line_1: string;
  address_line_2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  phone_number?: string;
  email_address?: string;
  contact_persons: ContactPerson[];
  fuel_types?: string[];
  fuel_prices?: Record<string, number>;
  fuel_brand?: string;
  other_offerings?: OtherOfferings;
}

type MenuView = 'menu' | 'garage-info' | 'fuel-prices' | 'contact-management' | 'local-accounts' | 'local-accounts-menu' | 'active-accounts' | 'view-invoices' | 'create-statements' | 'payments' | 'add-new-client' | 'fee-invoices' | 'other-offerings';

export default function GaragePortal({ garageId, garageName, garageEmail, garagePassword, onLogout }: GaragePortalProps) {
  const [currentView, setCurrentView] = useState<MenuView>('menu');
  const [garage, setGarage] = useState<GarageData | null>(null);
  const [fuelTypes, setFuelTypes] = useState<string[]>([]);
  const [fuelPrices, setFuelPrices] = useState<Record<string, number>>({});
  const [otherOfferings, setOtherOfferings] = useState<OtherOfferings>({});
  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([]);
  const [newFuelType, setNewFuelType] = useState('');
  const [intakeFormType, setIntakeFormType] = useState<'organisation' | 'individual' | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editedGarageInfo, setEditedGarageInfo] = useState({
    name: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    province: '',
    postal_code: '',
    latitude: '',
    longitude: '',
    phone_number: '',
    email_address: '',
    fuel_brand: ''
  });

  useEffect(() => {
    loadGarageData();
  }, [garageId]);

  const loadGarageData = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('garages')
        .select('*')
        .eq('id', garageId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Garage not found');

      const roundedFuelPrices: Record<string, number> = {};
      if (data.fuel_prices) {
        Object.keys(data.fuel_prices).forEach(fuelType => {
          roundedFuelPrices[fuelType] = Math.round(data.fuel_prices[fuelType] * 100) / 100;
        });
      }

      setGarage(data);
      setFuelTypes(data.fuel_types || []);
      setFuelPrices(roundedFuelPrices);
      setOtherOfferings(data.other_offerings || {});
      setContactPersons(data.contact_persons || []);
      setEditedGarageInfo({
        name: data.name || '',
        address_line_1: data.address_line_1 || '',
        address_line_2: data.address_line_2 || '',
        city: data.city || '',
        province: data.province || '',
        postal_code: data.postal_code || '',
        latitude: data.latitude?.toString() || '',
        longitude: data.longitude?.toString() || '',
        phone_number: data.phone_number || '',
        email_address: data.email_address || '',
        fuel_brand: data.fuel_brand || ''
      });
    } catch (err: any) {
      console.error('Error loading garage:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGarageInfo = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updateData: any = {
        name: editedGarageInfo.name.trim(),
        address_line_1: editedGarageInfo.address_line_1.trim(),
        address_line_2: editedGarageInfo.address_line_2.trim(),
        city: editedGarageInfo.city.trim(),
        province: editedGarageInfo.province,
        postal_code: editedGarageInfo.postal_code.trim(),
        phone_number: editedGarageInfo.phone_number.trim(),
        email_address: editedGarageInfo.email_address.trim(),
        fuel_brand: editedGarageInfo.fuel_brand.trim()
      };

      if (editedGarageInfo.latitude.trim()) {
        updateData.latitude = parseFloat(editedGarageInfo.latitude);
      }
      if (editedGarageInfo.longitude.trim()) {
        updateData.longitude = parseFloat(editedGarageInfo.longitude);
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.access_token) {
        const { error: updateError } = await supabase
          .from('garages')
          .update(updateData)
          .eq('id', garageId);

        if (updateError) throw updateError;
      } else {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/garage-update`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            garageEmail,
            garagePassword,
            garageId,
            updateData,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update garage information');
        }
      }

      setSuccess('Garage information updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
      await loadGarageData();
    } catch (err: any) {
      console.error('Error updating garage information:', err);
      setError(err.message || 'Failed to update garage information');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const updateData = {
        fuel_types: fuelTypes,
        fuel_prices: fuelPrices,
        other_offerings: otherOfferings,
        contact_persons: contactPersons,
      };

      if (session?.access_token) {
        // Authenticated via Supabase Auth — use direct client (RLS allows garage_user to update own garage)
        const { error: updateError } = await supabase
          .from('garages')
          .update(updateData)
          .eq('id', garageId);

        if (updateError) throw updateError;
      } else {
        // Password-based garage login — route through edge function
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/garage-update`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            garageEmail,
            garagePassword,
            garageId,
            updateData,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update garage information');
        }
      }

      setSuccess('Changes saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
      loadGarageData();
    } catch (err: any) {
      console.error('Error updating garage:', err);
      setError(err.message || 'Failed to update garage information');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (garage) {
      const roundedFuelPrices: Record<string, number> = {};
      if (garage.fuel_prices) {
        Object.keys(garage.fuel_prices).forEach(fuelType => {
          roundedFuelPrices[fuelType] = Math.round(garage.fuel_prices![fuelType] * 100) / 100;
        });
      }
      setFuelTypes(garage.fuel_types || []);
      setFuelPrices(roundedFuelPrices);
      setOtherOfferings(garage.other_offerings || {});
      setContactPersons(garage.contact_persons || []);
      setNewFuelType('');
      setError('');
      setSuccess('');
    }
    setCurrentView('menu');
  };

  const handleAddFuelType = () => {
    if (!newFuelType) {
      setError('Please select a fuel type');
      return;
    }
    if (fuelTypes.includes(newFuelType)) {
      setError('This fuel type is already added');
      return;
    }
    setFuelTypes([...fuelTypes, newFuelType]);
    setFuelPrices({ ...fuelPrices, [newFuelType]: 0 });
    setNewFuelType('');
    setError('');
  };

  const handleRemoveFuelType = (fuelType: string) => {
    setFuelTypes(fuelTypes.filter(ft => ft !== fuelType));
    const newPrices = { ...fuelPrices };
    delete newPrices[fuelType];
    setFuelPrices(newPrices);
  };

  const getAvailableFuelTypesForSelection = () => {
    return AVAILABLE_FUEL_TYPES.filter(ft => !fuelTypes.includes(ft.value));
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!garage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-center text-gray-900">Garage not found</p>
          <button
            onClick={onLogout}
            className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {currentView !== 'menu' &&
               currentView !== 'active-accounts' &&
               currentView !== 'view-invoices' &&
               currentView !== 'create-statements' &&
               currentView !== 'payments' &&
               currentView !== 'add-new-client' &&
               currentView !== 'fee-invoices' &&
               currentView !== 'local-accounts' && (
                <button
                  onClick={() => setCurrentView('menu')}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Back to Menu"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="bg-blue-600 p-2 rounded-lg">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{garageName}</h1>
                <p className="text-xs text-gray-600">
                  {currentView === 'menu' ? 'Garage Portal' :
                   currentView === 'garage-info' ? 'Garage Organization Information' :
                   currentView === 'fuel-prices' ? 'Fuel Prices' :
                   currentView === 'contact-management' ? 'Contact Persons & Users' :
                   currentView === 'local-accounts-menu' ? 'Local Account Clients' :
                   currentView === 'active-accounts' ? 'Active Accounts' :
                   currentView === 'view-invoices' ? 'View Fuel Invoices' :
                   currentView === 'create-statements' ? 'Create Statements' :
                   currentView === 'payments' ? 'Payments' :
                   currentView === 'add-new-client' ? 'Add New Client' :
                   currentView === 'fee-invoices' ? 'Fee Invoices' :
                   currentView === 'local-accounts' ? 'Local Account Clients' :
                   'Other Offerings'}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        {currentView === 'menu' && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Your Garage Portal</h2>
              <p className="text-gray-600">Select an option below to manage your garage</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <button
                onClick={() => setCurrentView('garage-info')}
                className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6 hover:border-blue-500 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                    <Building2 className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Garage Organization Information</h3>
                    <p className="text-sm text-gray-600">View and update your garage location, contact details, and business information</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentView('fuel-prices')}
                className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6 hover:border-green-500 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-600 transition-colors">
                    <Fuel className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Fuel Prices</h3>
                    <p className="text-sm text-gray-600">Manage your fuel types and update pricing information</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentView('contact-management')}
                className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6 hover:border-blue-500 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                    <Users className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Contact Persons &amp; Users</h3>
                    <p className="text-sm text-gray-600">Manage garage contacts and assign portal access permissions</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentView('local-accounts-menu')}
                className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6 hover:border-amber-500 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-600 transition-colors">
                    <Building2 className="w-6 h-6 text-amber-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Local Account Clients</h3>
                    <p className="text-sm text-gray-600">Manage local account client organizations and their account settings</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentView('other-offerings')}
                className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6 hover:border-teal-500 hover:shadow-md transition-all text-left group md:col-span-2"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center group-hover:bg-teal-600 transition-colors">
                    <ShoppingBag className="w-6 h-6 text-teal-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Other Offerings</h3>
                    <p className="text-sm text-gray-600">Manage additional services like convenience stores, takeaways, and other offerings</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {currentView === 'garage-info' && (
          <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Garage Information</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">{success}</p>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Garage Name *
                </label>
                <input
                  type="text"
                  value={editedGarageInfo.name}
                  onChange={(e) => setEditedGarageInfo({ ...editedGarageInfo, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  value={editedGarageInfo.address_line_1}
                  onChange={(e) => setEditedGarageInfo({ ...editedGarageInfo, address_line_1: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Street address"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={editedGarageInfo.address_line_2}
                  onChange={(e) => setEditedGarageInfo({ ...editedGarageInfo, address_line_2: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Suburb, Unit, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  value={editedGarageInfo.city}
                  onChange={(e) => setEditedGarageInfo({ ...editedGarageInfo, city: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Province *
                </label>
                <select
                  value={editedGarageInfo.province}
                  onChange={(e) => setEditedGarageInfo({ ...editedGarageInfo, province: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  required
                >
                  <option value="">Select province</option>
                  <option value="Eastern Cape">Eastern Cape</option>
                  <option value="Free State">Free State</option>
                  <option value="Gauteng">Gauteng</option>
                  <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                  <option value="Limpopo">Limpopo</option>
                  <option value="Mpumalanga">Mpumalanga</option>
                  <option value="Northern Cape">Northern Cape</option>
                  <option value="North West">North West</option>
                  <option value="Western Cape">Western Cape</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={editedGarageInfo.postal_code}
                  onChange={(e) => setEditedGarageInfo({ ...editedGarageInfo, postal_code: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Latitude (Optional)
                </label>
                <input
                  type="text"
                  value={editedGarageInfo.latitude}
                  onChange={(e) => setEditedGarageInfo({ ...editedGarageInfo, latitude: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="-26.2041"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Longitude (Optional)
                </label>
                <input
                  type="text"
                  value={editedGarageInfo.longitude}
                  onChange={(e) => setEditedGarageInfo({ ...editedGarageInfo, longitude: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="28.0473"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Phone *
                </label>
                <input
                  type="tel"
                  value={editedGarageInfo.phone_number}
                  onChange={(e) => setEditedGarageInfo({ ...editedGarageInfo, phone_number: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="012 345 6789"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editedGarageInfo.email_address}
                  onChange={(e) => setEditedGarageInfo({ ...editedGarageInfo, email_address: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="info@garage.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fuel Brand
                </label>
                <select
                  value={editedGarageInfo.fuel_brand}
                  onChange={(e) => setEditedGarageInfo({ ...editedGarageInfo, fuel_brand: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Select fuel brand</option>
                  <option value="Shell">Shell</option>
                  <option value="BP">BP</option>
                  <option value="Total">Total</option>
                  <option value="Engen">Engen</option>
                  <option value="Sasol">Sasol</option>
                  <option value="Caltex">Caltex</option>
                  <option value="Independent">Independent</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveGarageInfo}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
        )}

        {currentView === 'fuel-prices' && (
          <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Fuel Types & Prices Management</h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  Select the fuel types you offer and set their prices. Prices are in Rand per liter.
                </p>

                <div className="flex gap-2">
                  <select
                    value={newFuelType}
                    onChange={(e) => setNewFuelType(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    disabled={getAvailableFuelTypesForSelection().length === 0}
                  >
                    <option value="">
                      {getAvailableFuelTypesForSelection().length === 0
                        ? 'All fuel types added'
                        : 'Select a fuel type to add'}
                    </option>
                    {getAvailableFuelTypesForSelection().map((fuelType) => (
                      <option key={fuelType.value} value={fuelType.value}>
                        {fuelType.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddFuelType}
                    disabled={!newFuelType || getAvailableFuelTypesForSelection().length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>

              {fuelTypes.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No fuel types added yet.</p>
                  <p className="text-gray-500 text-sm mt-2">Use the dropdown above to add your first fuel type.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortFuelTypes(fuelTypes).map((fuelType) => (
                    <div
                      key={fuelType}
                      className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-900">
                          {getFuelTypeDisplayName(fuelType)}
                        </label>
                        <p className="text-xs text-gray-500 mt-0.5">Price per liter</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-gray-700 font-medium">R</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={fuelPrices[fuelType] || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            const roundedValue = isNaN(value) ? 0 : Math.round(value * 100) / 100;
                            setFuelPrices({
                              ...fuelPrices,
                              [fuelType]: roundedValue
                            });
                          }}
                          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0.00"
                        />
                        <button
                          onClick={() => handleRemoveFuelType(fuelType)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove fuel type"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <p className="text-blue-900 text-sm font-medium">Guidelines:</p>
                <ul className="text-blue-800 text-sm mt-2 space-y-1 list-disc list-inside">
                  <li>Select from standard South African fuel types</li>
                  <li>Enter prices in Rand per liter</li>
                  <li>Prices are visible to all users on the system</li>
                  <li>Update prices regularly to reflect market changes</li>
                  <li>Click "Save Changes" at the bottom to apply your updates</li>
                </ul>
              </div>
            </div>
          </div>
          </div>
        )}

        {currentView === 'contact-management' && (
          <div className="max-w-4xl mx-auto">
          <GarageContactManagement
            contacts={contactPersons}
            onUpdate={setContactPersons}
          />
          </div>
        )}

        {currentView === 'local-accounts-menu' && (
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Local Account Clients</h2>
              <p className="text-sm text-gray-600 mt-1">Manage your local account client organizations</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <button
                onClick={() => setCurrentView('active-accounts')}
                className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6 hover:border-green-500 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-600 transition-colors">
                    <Building2 className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Active Accounts</h3>
                    <p className="text-sm text-gray-600">View and manage active local account clients</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentView('view-invoices')}
                className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6 hover:border-blue-500 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                    <Receipt className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">View Fuel Invoices</h3>
                    <p className="text-sm text-gray-600">View and download client fuel invoices</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentView('create-statements')}
                className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6 hover:border-green-500 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-600 transition-colors">
                    <FileText className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Create Statements</h3>
                    <p className="text-sm text-gray-600">Generate and manage client statements</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentView('payments')}
                className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6 hover:border-emerald-500 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
                    <CreditCard className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Payments</h3>
                    <p className="text-sm text-gray-600">Record and manage client payments</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentView('add-new-client')}
                className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6 hover:border-amber-500 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-600 transition-colors">
                    <Plus className="w-6 h-6 text-amber-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Add New Client</h3>
                    <p className="text-sm text-gray-600">Add a new local account client organization</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentView('fee-invoices')}
                className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6 hover:border-orange-500 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-600 transition-colors">
                    <FileText className="w-6 h-6 text-orange-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Fee Invoices</h3>
                    <p className="text-sm text-gray-600">Generate and view monthly management fee invoices for clients</p>
                  </div>
                </div>
              </button>

              <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                    <Printer className="w-6 h-6 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Client Setup Form</h3>
                    <p className="text-sm text-gray-600">Print a blank form for new clients to complete their details, vehicles and drivers</p>
                  </div>
                </div>
                <div className="flex gap-3 pl-16">
                  <button
                    onClick={() => setIntakeFormType('organisation')}
                    className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-600 hover:border-teal-600 hover:text-white transition-all text-left group"
                  >
                    <Building2 className="w-4 h-4 text-teal-600 group-hover:text-white flex-shrink-0 transition-colors" />
                    <div>
                      <div className="text-sm font-semibold text-gray-800 group-hover:text-white transition-colors">Organisation</div>
                      <div className="text-xs text-gray-500 group-hover:text-teal-100 transition-colors">Company / business account</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setIntakeFormType('individual')}
                    className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-600 hover:border-teal-600 hover:text-white transition-all text-left group"
                  >
                    <User className="w-4 h-4 text-teal-600 group-hover:text-white flex-shrink-0 transition-colors" />
                    <div>
                      <div className="text-sm font-semibold text-gray-800 group-hover:text-white transition-colors">Individual</div>
                      <div className="text-xs text-gray-500 group-hover:text-teal-100 transition-colors">Personal / private account</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {intakeFormType && (
          <GarageClientIntakeForm
            garageName={garageName}
            formType={intakeFormType}
            onClose={() => setIntakeFormType(null)}
          />
        )}

        {(currentView === 'active-accounts' || currentView === 'view-invoices' || currentView === 'create-statements' || currentView === 'payments' || currentView === 'add-new-client' || currentView === 'fee-invoices' || currentView === 'local-accounts') && (
          <GarageLocalAccounts
            garageId={garageId}
            garageName={garageName}
            garageEmail={garageEmail}
            garagePassword={garagePassword}
            garageContacts={contactPersons}
            initialView={
              currentView === 'active-accounts' ? 'active' :
              currentView === 'view-invoices' ? 'view-invoices' :
              currentView === 'create-statements' ? 'create-statements' :
              currentView === 'payments' ? 'payments' :
              currentView === 'add-new-client' ? 'add-client' :
              currentView === 'fee-invoices' ? 'fee-invoices' :
              'all'
            }
            onBack={() => setCurrentView('menu')}
          />
        )}

        {currentView === 'other-offerings' && (
          <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Other Offerings</h2>
            <p className="text-sm text-gray-600 mb-4">
              Select the additional services and products offered at your location
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={otherOfferings?.convenience_shop || false}
                  onChange={(e) => {
                    setOtherOfferings({
                      ...otherOfferings,
                      convenience_shop: e.target.checked
                    });
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">Convenience Shop</span>
              </div>

              <div className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={otherOfferings?.branded_convenience_store?.enabled || false}
                    onChange={(e) => {
                      setOtherOfferings({
                        ...otherOfferings,
                        branded_convenience_store: e.target.checked
                          ? { enabled: true, name: otherOfferings?.branded_convenience_store?.name || '' }
                          : undefined
                      });
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">Branded Convenience Store</span>
                </div>
                {otherOfferings?.branded_convenience_store?.enabled && (
                  <input
                    type="text"
                    placeholder="Enter brand name"
                    value={otherOfferings.branded_convenience_store.name}
                    onChange={(e) => {
                      setOtherOfferings({
                        ...otherOfferings,
                        branded_convenience_store: {
                          enabled: true,
                          name: e.target.value
                        }
                      });
                    }}
                    className="w-full ml-7 border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                )}
              </div>

              <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={otherOfferings?.takeaways || false}
                  onChange={(e) => {
                    setOtherOfferings({
                      ...otherOfferings,
                      takeaways: e.target.checked
                    });
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">Takeaways</span>
              </div>

              <div className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={otherOfferings?.branded_takeaways?.enabled || false}
                    onChange={(e) => {
                      setOtherOfferings({
                        ...otherOfferings,
                        branded_takeaways: e.target.checked
                          ? { enabled: true, name: otherOfferings?.branded_takeaways?.name || '' }
                          : undefined
                      });
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">Branded Takeaways</span>
                </div>
                {otherOfferings?.branded_takeaways?.enabled && (
                  <input
                    type="text"
                    placeholder="Enter brand name"
                    value={otherOfferings.branded_takeaways.name}
                    onChange={(e) => {
                      setOtherOfferings({
                        ...otherOfferings,
                        branded_takeaways: {
                          enabled: true,
                          name: e.target.value
                        }
                      });
                    }}
                    className="w-full ml-7 border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                )}
              </div>

              <div className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={otherOfferings?.specialty_offering?.enabled || false}
                    onChange={(e) => {
                      setOtherOfferings({
                        ...otherOfferings,
                        specialty_offering: e.target.checked
                          ? { enabled: true, name: otherOfferings?.specialty_offering?.name || '' }
                          : undefined
                      });
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">Specialty Offering</span>
                </div>
                {otherOfferings?.specialty_offering?.enabled && (
                  <input
                    type="text"
                    placeholder="Describe specialty offering"
                    value={otherOfferings.specialty_offering.name}
                    onChange={(e) => {
                      setOtherOfferings({
                        ...otherOfferings,
                        specialty_offering: {
                          enabled: true,
                          name: e.target.value
                        }
                      });
                    }}
                    className="w-full ml-7 border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                )}
              </div>

              <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={otherOfferings?.lpg_gas || false}
                  onChange={(e) => {
                    setOtherOfferings({
                      ...otherOfferings,
                      lpg_gas: e.target.checked
                    });
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">LPG Gas</span>
              </div>

              <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={otherOfferings?.paraffin || false}
                  onChange={(e) => {
                    setOtherOfferings({
                      ...otherOfferings,
                      paraffin: e.target.checked
                    });
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">Paraffin</span>
              </div>

              <div className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={otherOfferings?.other?.enabled || false}
                    onChange={(e) => {
                      setOtherOfferings({
                        ...otherOfferings,
                        other: e.target.checked
                          ? { enabled: true, name: otherOfferings?.other?.name || '' }
                          : undefined
                      });
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">Other</span>
                </div>
                {otherOfferings?.other?.enabled && (
                  <input
                    type="text"
                    placeholder="Describe other offering"
                    value={otherOfferings.other.name}
                    onChange={(e) => {
                      setOtherOfferings({
                        ...otherOfferings,
                        other: {
                          enabled: true,
                          name: e.target.value
                        }
                      });
                    }}
                    className="w-full ml-7 border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
              <p className="text-blue-900 text-sm font-medium">Guidelines:</p>
              <ul className="text-blue-800 text-sm mt-2 space-y-1 list-disc list-inside">
                <li>Select all services and products you offer</li>
                <li>For branded items, provide the brand name</li>
                <li>These offerings are visible to all users</li>
                <li>Click "Save Changes" at the bottom to apply your updates</li>
              </ul>
            </div>
          </div>
          </div>
        )}
      </div>

      {(currentView === 'garage-info' || currentView === 'fuel-prices' || currentView === 'other-offerings' || currentView === 'contact-management') && (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <span>{success}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
