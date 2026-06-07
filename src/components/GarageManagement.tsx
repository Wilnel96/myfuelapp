import { useState, useEffect, useRef } from 'react';
import { Store, Plus, CreditCard as Edit2, Trash2, X, Search, MapPin, Phone, Mail, Smartphone, ArrowLeft, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import GarageContactManagement from './GarageContactManagement';
import { getFuelTypeDisplayName, AVAILABLE_FUEL_TYPES } from '../lib/fuelTypes';
import { SOUTH_AFRICAN_FUEL_BRANDS } from '../lib/fuelBrands';
import { PRICE_ZONE_REFS, lookupZone, downloadZoneReference, KNOWN_ZONE_CODES } from '../lib/priceZones';

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

interface Garage {
  id: string;
  name: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  province?: string;
  postal_code?: string;
  contact_persons: ContactPerson[];
  vat_number?: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  branch_code: string;
  commission_rate: number;
  status: string;
  fuel_types?: string[];
  fuel_prices?: Record<string, number>;
  fuel_brand?: string;
  other_offerings?: OtherOfferings;
  price_zone?: string;
  latitude?: number;
  longitude?: number;
}

interface GarageManagementProps {
  onNavigate?: (view: string | null) => void;
}

function PriceZoneSelect({
  value,
  city,
  onChange,
}: {
  value: string;
  city: string;
  onChange: (z: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSuggestion(city ? (lookupZone(city)?.zone ?? null) : null);
  }, [city]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Matches from district lookup when searching by town name
  const townMatches = search.trim().length > 1
    ? PRICE_ZONE_REFS.filter(r =>
        r.town.toLowerCase().includes(search.toLowerCase()) ||
        r.district.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  // Direct zone code matches (e.g. typing "5" shows zone 5, 5A)
  const codeMatches = search.trim().length >= 1
    ? KNOWN_ZONE_CODES.filter(z => z.toLowerCase().startsWith(search.toLowerCase()))
    : [];

  const hasResults = townMatches.length > 0 || codeMatches.length > 0;

  return (
    <div ref={wrapperRef} className="space-y-2">
      {suggestion && !value && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
          <span className="text-blue-700">
            Suggested zone for <strong>{city}</strong>: <strong>{suggestion}</strong>
          </span>
          <button
            type="button"
            onClick={() => onChange(suggestion)}
            className="ml-auto text-xs font-medium text-blue-600 hover:text-blue-800 underline"
          >
            Use this
          </button>
        </div>
      )}

      {/* Direct zone code entry */}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value.toUpperCase())}
        placeholder="Enter zone code, e.g. 1, 3, 5A, 7..."
        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
      />

      {/* Town lookup to find the correct code */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Look up code by town or district name..."
          className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {open && hasResults && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {codeMatches.length > 0 && (
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border-b">
                Zone codes
              </div>
            )}
            {codeMatches.map(z => (
              <button
                key={z}
                type="button"
                onClick={() => { onChange(z); setSearch(''); setOpen(false); }}
                className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0 font-mono font-medium text-blue-700"
              >
                Zone {z}
              </button>
            ))}
            {townMatches.length > 0 && (
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border-b">
                Towns / districts
              </div>
            )}
            {townMatches.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { onChange(r.zone); setSearch(''); setOpen(false); }}
                className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
              >
                <span className="font-medium">{r.town}</span>
                <span className="text-gray-500"> · {r.district}, {r.province}</span>
                <span className="float-right font-mono font-semibold text-blue-600">Zone {r.zone}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GarageManagement({ onNavigate }: GarageManagementProps) {
  const [garages, setGarages] = useState<Garage[]>([]);
  const [filteredGarages, setFilteredGarages] = useState<Garage[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGarage, setEditingGarage] = useState<Garage | null>(null);
  const [selectedGarage, setSelectedGarage] = useState<Garage | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    province: '',
    postal_code: '',
    contact_persons: [] as ContactPerson[],
    vat_number: '',
    bank_name: '',
    account_holder: '',
    account_number: '',
    branch_code: '',
    commission_rate: 0.5,
    status: 'active',
    fuel_types: [] as string[],
    fuel_prices: {} as Record<string, number>,
    fuel_brand: '',
    other_offerings: {} as OtherOfferings,
    price_zone: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  useEffect(() => {
    loadGarages();

    // Restore form state from session storage
    const savedFormState = sessionStorage.getItem('garageManagementFormState');
    if (savedFormState) {
      try {
        const { showForm: savedShowForm, editingGarage: savedEditingGarage, formData: savedFormData } = JSON.parse(savedFormState);
        if (savedShowForm) {
          setShowForm(true);
          if (savedEditingGarage) {
            setEditingGarage(savedEditingGarage);
          }
          if (savedFormData) {
            setFormData(savedFormData);
          }
        }
      } catch (e) {
        console.error('Error restoring form state:', e);
        sessionStorage.removeItem('garageManagementFormState');
      }
    }
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredGarages(garages);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = garages.filter((garage) => {
        const contactMatch = garage.contact_persons?.some(contact =>
          contact.name?.toLowerCase().includes(term) ||
          contact.surname?.toLowerCase().includes(term) ||
          contact.email?.toLowerCase().includes(term) ||
          contact.mobile_phone?.toLowerCase().includes(term) ||
          contact.phone?.toLowerCase().includes(term)
        );

        return garage.name?.toLowerCase().includes(term) ||
          garage.address_line_1?.toLowerCase().includes(term) ||
          garage.address_line_2?.toLowerCase().includes(term) ||
          garage.city?.toLowerCase().includes(term) ||
          garage.province?.toLowerCase().includes(term) ||
          garage.postal_code?.toLowerCase().includes(term) ||
          garage.bank_name?.toLowerCase().includes(term) ||
          garage.account_number?.toLowerCase().includes(term) ||
          contactMatch;
      });
      setFilteredGarages(filtered);
    }
  }, [searchTerm, garages]);

  // Save form state to session storage whenever it changes
  useEffect(() => {
    if (showForm) {
      sessionStorage.setItem('garageManagementFormState', JSON.stringify({
        showForm,
        editingGarage,
        formData
      }));
    } else {
      sessionStorage.removeItem('garageManagementFormState');
    }
  }, [showForm, editingGarage, formData]);

  const loadGarages = async () => {
    const { data } = await supabase
      .from('garages')
      .select('*')
      .order('name');

    if (data) setGarages(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.city.trim()) {
        alert('City is required');
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editingGarage) {
        const { error } = await supabase
          .from('garages')
          .update(formData)
          .eq('id', editingGarage.id);

        if (error) throw error;
      } else {
        // Insert new garage (organization_id is always NULL - garages are standalone)
        const { error } = await supabase
          .from('garages')
          .insert({
            ...formData,
            organization_id: null
          });

        if (error) throw error;
      }

      resetForm();
      loadGarages();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (garage: Garage) => {
    setEditingGarage(garage);

    const roundedFuelPrices: Record<string, number> = {};
    if (garage.fuel_prices) {
      Object.keys(garage.fuel_prices).forEach(fuelType => {
        roundedFuelPrices[fuelType] = Math.round(garage.fuel_prices![fuelType] * 100) / 100;
      });
    }

    setFormData({
      name: garage.name,
      address_line_1: garage.address_line_1,
      address_line_2: garage.address_line_2 || '',
      city: garage.city,
      province: garage.province || '',
      postal_code: garage.postal_code || '',
      contact_persons: garage.contact_persons || [],
      vat_number: garage.vat_number || '',
      bank_name: garage.bank_name,
      account_holder: garage.account_holder,
      account_number: garage.account_number,
      branch_code: garage.branch_code,
      commission_rate: garage.commission_rate,
      status: garage.status,
      fuel_types: garage.fuel_types || [],
      fuel_prices: roundedFuelPrices,
      fuel_brand: garage.fuel_brand || '',
      other_offerings: garage.other_offerings || {},
      price_zone: garage.price_zone || '',
      latitude: garage.latitude,
      longitude: garage.longitude,
    });
    setSelectedGarage(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this garage?')) return;

    const { error } = await supabase
      .from('garages')
      .delete()
      .eq('id', id);

    if (error) {
      alert(error.message);
    } else {
      loadGarages();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address_line_1: '',
      address_line_2: '',
      city: '',
      province: '',
      postal_code: '',
      contact_persons: [],
      vat_number: '',
      bank_name: '',
      account_holder: '',
      account_number: '',
      branch_code: '',
      commission_rate: 0.5,
      status: 'active',
      fuel_types: [],
      fuel_prices: {},
      fuel_brand: '',
      other_offerings: {},
      price_zone: '',
      latitude: undefined,
      longitude: undefined,
    });
    setEditingGarage(null);
    setShowForm(false);
  };

  const openInMaps = (location: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const encodedLocation = encodeURIComponent(location);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedLocation}`, '_blank', 'noopener,noreferrer');
  };

  const autoFillCoordinates = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!formData.address_line_1 || !formData.city) {
      alert('Please enter at least Address Line 1 and City before auto-filling coordinates');
      return;
    }

    setGeocoding(true);

    try {
      const addressParts = [
        formData.address_line_1,
        formData.address_line_2,
        formData.city,
        formData.province,
        formData.postal_code,
        'South Africa'
      ].filter(Boolean);

      const fullAddress = addressParts.join(', ');
      const encodedAddress = encodeURIComponent(fullAddress);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
        {
          headers: {
            'User-Agent': 'FleetManagementSystem/1.0'
          }
        }
      );

      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setFormData({
          ...formData,
          latitude: parseFloat(lat),
          longitude: parseFloat(lon)
        });
        alert('Coordinates found and filled successfully!');
      } else {
        alert('Could not find coordinates for this address. Please enter them manually or try a more specific address.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Failed to fetch coordinates. Please enter them manually.');
    } finally {
      setGeocoding(false);
    }
  };

  const openAddressInMaps = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // If coordinates exist, use them for better accuracy
    if (formData.latitude && formData.longitude) {
      const coordsQuery = `${formData.latitude},${formData.longitude}`;
      window.open(`https://www.google.com/maps/search/?api=1&query=${coordsQuery}`, '_blank', 'noopener,noreferrer');
      return;
    }

    // Otherwise, use the address
    const addressParts = [
      formData.address_line_1,
      formData.address_line_2,
      formData.city,
      formData.province,
      formData.postal_code,
      'South Africa'
    ].filter(Boolean);

    const fullAddress = addressParts.join(', ');
    openInMaps(fullAddress, e);
  };

  return (
    <div className="space-y-6 -my-6">
      <div className="sticky top-0 z-20 bg-white -mx-4 px-4 py-6 pb-4 border-b border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Garage Management</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Garage
            </button>
            {onNavigate && (
              <button
                onClick={() => onNavigate(null)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Main Menu
              </button>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingGarage ? 'Edit Garage' : 'Add New Garage'}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="garage-form"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                >
                  {loading ? 'Saving...' : editingGarage ? 'Update' : 'Save'}
                </button>
              </div>
            </div>

            <form id="garage-form" onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Garage Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Brand</label>
                <select
                  value={formData.fuel_brand}
                  onChange={(e) => setFormData({ ...formData, fuel_brand: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
                  <option value="">Select a brand...</option>
                  {SOUTH_AFRICAN_FUEL_BRANDS.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Select the fuel brand for this garage</p>
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Fuel Types & Prices</label>
                <div className="space-y-3">
                  {AVAILABLE_FUEL_TYPES.map((fuelTypeOption) => (
                    <div key={fuelTypeOption.value} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.fuel_types.includes(fuelTypeOption.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, fuel_types: [...formData.fuel_types, fuelTypeOption.value] });
                          } else {
                            const newFuelTypes = formData.fuel_types.filter(ft => ft !== fuelTypeOption.value);
                            const newFuelPrices = { ...formData.fuel_prices };
                            delete newFuelPrices[fuelTypeOption.value];
                            setFormData({ ...formData, fuel_types: newFuelTypes, fuel_prices: newFuelPrices });
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700 w-32">{fuelTypeOption.label}</span>
                      {formData.fuel_types.includes(fuelTypeOption.value) && (
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-sm text-gray-600">R</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={formData.fuel_prices[fuelTypeOption.value] || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              const roundedValue = isNaN(value) ? 0 : Math.round(value * 100) / 100;
                              setFormData({
                                ...formData,
                                fuel_prices: {
                                  ...formData.fuel_prices,
                                  [fuelTypeOption.value]: roundedValue
                                }
                              });
                            }}
                            className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
                          />
                          <span className="text-sm text-gray-600">per liter</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Select fuel types and set their prices per liter</p>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Price Zone</label>
                    <button
                      type="button"
                      onClick={downloadZoneReference}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      <Download className="w-3 h-3" />
                      Download zone reference
                    </button>
                  </div>
                  <PriceZoneSelect
                    value={formData.price_zone}
                    city={formData.city}
                    onChange={zone => setFormData({ ...formData, price_zone: zone })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Select a zone or search by town name. Towns not listed fall under a nearby
                    magisterial district (e.g. Ashton → Montagu → Inland Zone 1).
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Other Offerings</label>
                <div className="space-y-3">
                  {/* Convenience Shop */}
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.other_offerings?.convenience_shop || false}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          other_offerings: {
                            ...formData.other_offerings,
                            convenience_shop: e.target.checked
                          }
                        });
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">Convenience Shop</span>
                  </div>

                  {/* Branded Convenience Store */}
                  <div className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="checkbox"
                        checked={formData.other_offerings?.branded_convenience_store?.enabled || false}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            other_offerings: {
                              ...formData.other_offerings,
                              branded_convenience_store: e.target.checked
                                ? { enabled: true, name: formData.other_offerings?.branded_convenience_store?.name || '' }
                                : undefined
                            }
                          });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">Branded Convenience Store</span>
                    </div>
                    {formData.other_offerings?.branded_convenience_store?.enabled && (
                      <input
                        type="text"
                        placeholder="Enter brand name"
                        value={formData.other_offerings.branded_convenience_store.name}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            other_offerings: {
                              ...formData.other_offerings,
                              branded_convenience_store: {
                                enabled: true,
                                name: e.target.value
                              }
                            }
                          });
                        }}
                        className="w-full ml-7 border border-gray-300 rounded px-3 py-1.5 text-sm"
                      />
                    )}
                  </div>

                  {/* Takeaways */}
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.other_offerings?.takeaways || false}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          other_offerings: {
                            ...formData.other_offerings,
                            takeaways: e.target.checked
                          }
                        });
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">Takeaways</span>
                  </div>

                  {/* Branded Takeaways */}
                  <div className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="checkbox"
                        checked={formData.other_offerings?.branded_takeaways?.enabled || false}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            other_offerings: {
                              ...formData.other_offerings,
                              branded_takeaways: e.target.checked
                                ? { enabled: true, name: formData.other_offerings?.branded_takeaways?.name || '' }
                                : undefined
                            }
                          });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">Branded Takeaways</span>
                    </div>
                    {formData.other_offerings?.branded_takeaways?.enabled && (
                      <input
                        type="text"
                        placeholder="Enter brand name"
                        value={formData.other_offerings.branded_takeaways.name}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            other_offerings: {
                              ...formData.other_offerings,
                              branded_takeaways: {
                                enabled: true,
                                name: e.target.value
                              }
                            }
                          });
                        }}
                        className="w-full ml-7 border border-gray-300 rounded px-3 py-1.5 text-sm"
                      />
                    )}
                  </div>

                  {/* Specialty Offering */}
                  <div className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="checkbox"
                        checked={formData.other_offerings?.specialty_offering?.enabled || false}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            other_offerings: {
                              ...formData.other_offerings,
                              specialty_offering: e.target.checked
                                ? { enabled: true, name: formData.other_offerings?.specialty_offering?.name || '' }
                                : undefined
                            }
                          });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">Specialty Offering</span>
                    </div>
                    {formData.other_offerings?.specialty_offering?.enabled && (
                      <input
                        type="text"
                        placeholder="Describe specialty offering"
                        value={formData.other_offerings.specialty_offering.name}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            other_offerings: {
                              ...formData.other_offerings,
                              specialty_offering: {
                                enabled: true,
                                name: e.target.value
                              }
                            }
                          });
                        }}
                        className="w-full ml-7 border border-gray-300 rounded px-3 py-1.5 text-sm"
                      />
                    )}
                  </div>

                  {/* LPG Gas */}
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.other_offerings?.lpg_gas || false}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          other_offerings: {
                            ...formData.other_offerings,
                            lpg_gas: e.target.checked
                          }
                        });
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">LPG Gas</span>
                  </div>

                  {/* Paraffin */}
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.other_offerings?.paraffin || false}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          other_offerings: {
                            ...formData.other_offerings,
                            paraffin: e.target.checked
                          }
                        });
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">Paraffin</span>
                  </div>

                  {/* Other */}
                  <div className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="checkbox"
                        checked={formData.other_offerings?.other?.enabled || false}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            other_offerings: {
                              ...formData.other_offerings,
                              other: e.target.checked
                                ? { enabled: true, name: formData.other_offerings?.other?.name || '' }
                                : undefined
                            }
                          });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">Other</span>
                    </div>
                    {formData.other_offerings?.other?.enabled && (
                      <input
                        type="text"
                        placeholder="Describe other offering"
                        value={formData.other_offerings.other.name}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            other_offerings: {
                              ...formData.other_offerings,
                              other: {
                                enabled: true,
                                name: e.target.value
                              }
                            }
                          });
                        }}
                        className="w-full ml-7 border border-gray-300 rounded px-3 py-1.5 text-sm"
                      />
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Select additional services and products offered at this location</p>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Address Information</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={formData.address_line_1}
                      onChange={(e) => setFormData({ ...formData, address_line_1: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      placeholder="Address line 1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                    <input
                      type="text"
                      value={formData.address_line_2}
                      onChange={(e) => setFormData({ ...formData, address_line_2: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      placeholder="Address line 2 (optional)"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        placeholder="City"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                      <select
                        value={formData.province}
                        onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      >
                        <option value="">Select Province</option>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={formData.postal_code}
                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        placeholder="Postal code"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Location Coordinates <span className="text-gray-500 text-xs">(for distance calculation)</span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => autoFillCoordinates(e)}
                          disabled={geocoding || !formData.address_line_1 || !formData.city}
                          className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          <MapPin className="w-4 h-4" />
                          {geocoding ? 'Finding...' : 'Auto-fill Coordinates'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => openAddressInMaps(e)}
                          disabled={(!formData.address_line_1 && !formData.city) && (!formData.latitude || !formData.longitude)}
                          className="flex items-center gap-2 px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          <MapPin className="w-4 h-4" />
                          View on Map
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Latitude</label>
                        <input
                          type="number"
                          step="0.00000001"
                          value={formData.latitude || ''}
                          onChange={(e) => setFormData({ ...formData, latitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2"
                          placeholder="e.g., -33.9249"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Longitude</label>
                        <input
                          type="number"
                          step="0.00000001"
                          value={formData.longitude || ''}
                          onChange={(e) => setFormData({ ...formData, longitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2"
                          placeholder="e.g., 18.4241"
                        />
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                      Click "Auto-fill Coordinates" to automatically get location coordinates from the address, or "View on Map" to verify the location. If coordinates are available but address is missing, "View on Map" will use the coordinates.
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <GarageContactManagement
                  contacts={formData.contact_persons}
                  onUpdate={(contacts) => setFormData({ ...formData, contact_persons: contacts })}
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">VAT Information</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      VAT Number <span className="text-gray-400 text-xs">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.vat_number}
                      onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      placeholder="e.g., 4123456789 (optional)"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Banking Details</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Holder <span className="text-gray-400 text-xs">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.account_holder}
                      onChange={(e) => setFormData({ ...formData, account_holder: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Number <span className="text-gray-400 text-xs">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bank Name <span className="text-gray-400 text-xs">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Branch Code <span className="text-gray-400 text-xs">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.branch_code}
                      onChange={(e) => setFormData({ ...formData, branch_code: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commission Rate (%) <span className="text-gray-400 text-xs">(optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.commission_rate}
                    onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {!showForm && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search garages by name, location, or contact person..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              Total Garages: <span className="font-semibold">{filteredGarages.length}</span>
              {searchTerm && ` (filtered from ${garages.length})`}
            </p>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <div className="bg-white rounded-lg shadow border border-gray-200 divide-y divide-gray-200">
                {filteredGarages.map((garage) => (
                  <div
                    key={garage.id}
                    onClick={() => setSelectedGarage(garage)}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedGarage?.id === garage.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{garage.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const fullAddress = [
                                garage.address_line_1,
                                garage.address_line_2,
                                garage.city,
                                garage.province,
                                garage.postal_code,
                                'South Africa'
                              ].filter(field => field && field.trim() !== '').join(', ');
                              console.log('Opening maps with address:', fullAddress);
                              openInMaps(fullAddress, e);
                            }}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Open in Google Maps"
                          >
                            <MapPin className="w-4 h-4" />
                          </button>
                          <p className="text-sm text-gray-600">
                            {[garage.address_line_1, garage.address_line_2, garage.city, garage.postal_code].filter(field => field && field.trim() !== '').join(', ')}
                          </p>
                        </div>
                        {garage.fuel_types && garage.fuel_types.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {garage.fuel_types.map((fuelType) => (
                              <span key={fuelType} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                {getFuelTypeDisplayName(fuelType)}
                                {garage.fuel_prices && garage.fuel_prices[fuelType] && (
                                  <span className="font-semibold">R{garage.fuel_prices[fuelType].toFixed(2)}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          garage.status === 'active' ? 'bg-green-100 text-green-800' :
                          garage.status === 'suspended' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {garage.status}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(garage);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit Garage"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(garage.id);
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete Garage"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedGarage && (
              <div className="w-96 bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Store className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900 text-xl">{selectedGarage.name}</h2>
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                        selectedGarage.status === 'active' ? 'bg-green-100 text-green-800' :
                        selectedGarage.status === 'suspended' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedGarage.status}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedGarage(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex gap-2 mb-6 pb-6 border-b border-gray-200">
                  <button
                    type="button"
                    onClick={() => handleEdit(selectedGarage)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedGarage.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Location</h3>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const fullAddress = [
                          selectedGarage.address_line_1,
                          selectedGarage.address_line_2,
                          selectedGarage.city,
                          selectedGarage.province,
                          selectedGarage.postal_code,
                          'South Africa'
                        ].filter(field => field && field.trim() !== '').join(', ');
                        console.log('Opening maps with address:', fullAddress);
                        openInMaps(fullAddress, e);
                      }}
                      className="flex items-start gap-2 text-blue-600 hover:text-blue-800 text-sm transition-colors text-left"
                      title="Open in Google Maps"
                    >
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div className="hover:underline">
                        {[
                          selectedGarage.address_line_1,
                          selectedGarage.address_line_2,
                          selectedGarage.city,
                          selectedGarage.province,
                          selectedGarage.postal_code
                        ].filter(field => field && field.trim() !== '').join(', ')}
                      </div>
                    </button>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Contact Persons</h3>
                    <div className="space-y-3">
                      {selectedGarage.contact_persons && selectedGarage.contact_persons.length > 0 ? (
                        selectedGarage.contact_persons.map((contact, index) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="font-medium text-gray-900">{contact.name} {contact.surname}</div>
                              {contact.is_primary && (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                  Primary
                                </span>
                              )}
                            </div>
                            {contact.email && (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <Mail className="w-3 h-3 text-gray-400" />
                                <div className="break-all">{contact.email}</div>
                              </div>
                            )}
                            {contact.mobile_phone && (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <Smartphone className="w-3 h-3 text-gray-400" />
                                <div>{contact.mobile_phone}</div>
                              </div>
                            )}
                            {contact.phone && (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <Phone className="w-3 h-3 text-gray-400" />
                                <div>{contact.phone}</div>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 italic">No contacts added</p>
                      )}
                    </div>
                  </div>

                  {selectedGarage.fuel_types && selectedGarage.fuel_types.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Fuel Types & Prices</h3>
                      <div className="space-y-2">
                        {selectedGarage.fuel_types.map((fuelType) => (
                          <div key={fuelType} className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg">
                            <span className="text-sm font-medium text-blue-900">{getFuelTypeDisplayName(fuelType)}</span>
                            {selectedGarage.fuel_prices && selectedGarage.fuel_prices[fuelType] ? (
                              <span className="text-sm font-semibold text-blue-700">
                                R {selectedGarage.fuel_prices[fuelType].toFixed(2)} / L
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 italic">No price set</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedGarage.other_offerings && Object.keys(selectedGarage.other_offerings).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Other Offerings</h3>
                      <div className="space-y-1.5">
                        {selectedGarage.other_offerings.convenience_shop && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span>Convenience Shop</span>
                          </div>
                        )}
                        {selectedGarage.other_offerings.branded_convenience_store?.enabled && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span>Branded Convenience Store: {selectedGarage.other_offerings.branded_convenience_store.name}</span>
                          </div>
                        )}
                        {selectedGarage.other_offerings.takeaways && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span>Takeaways</span>
                          </div>
                        )}
                        {selectedGarage.other_offerings.branded_takeaways?.enabled && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span>Branded Takeaways: {selectedGarage.other_offerings.branded_takeaways.name}</span>
                          </div>
                        )}
                        {selectedGarage.other_offerings.specialty_offering?.enabled && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span>Specialty Offering: {selectedGarage.other_offerings.specialty_offering.name}</span>
                          </div>
                        )}
                        {selectedGarage.other_offerings.lpg_gas && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span>LPG Gas</span>
                          </div>
                        )}
                        {selectedGarage.other_offerings.paraffin && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span>Paraffin</span>
                          </div>
                        )}
                        {selectedGarage.other_offerings.other?.enabled && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span>Other: {selectedGarage.other_offerings.other.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedGarage.commission_rate && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Commission Rate</h3>
                      <div className="text-sm text-gray-700">{selectedGarage.commission_rate}%</div>
                    </div>
                  )}

                  {selectedGarage.price_zone && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Price Zone</h3>
                      <div className="text-sm text-gray-700">{selectedGarage.price_zone}</div>
                    </div>
                  )}

                  {selectedGarage.vat_number && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">VAT Information</h3>
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">VAT Number:</span> {selectedGarage.vat_number}
                      </div>
                    </div>
                  )}

                  {selectedGarage.bank_name && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Banking Details</h3>
                      <div className="space-y-1 text-sm text-gray-700">
                        <div><span className="font-medium">Bank:</span> {selectedGarage.bank_name}</div>
                        {selectedGarage.account_holder && (
                          <div><span className="font-medium">Holder:</span> {selectedGarage.account_holder}</div>
                        )}
                        <div><span className="font-medium">Account:</span> {selectedGarage.account_number}</div>
                        {selectedGarage.branch_code && (
                          <div><span className="font-medium">Branch:</span> {selectedGarage.branch_code}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {filteredGarages.length === 0 && (
            <div className="text-center py-12">
              <Store className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">
                {searchTerm ? 'No garages found matching your search' : 'No garages yet. Click "Add Garage" to get started.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
