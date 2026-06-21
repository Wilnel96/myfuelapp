import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getFuelTypeDisplayName, sortFuelTypes } from '../lib/fuelTypes';
import { Store, Search, MapPin, Phone, Mail, AlertCircle, ArrowLeft } from 'lucide-react';

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
  password: string;
  is_primary: boolean;
}

interface Garage {
  id: string;
  name: string;
  address_line_1: string;
  address_line_2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  contact_persons?: ContactPerson[];
  bank_name: string;
  account_number: string;
  account_holder?: string;
  branch_code: string;
  commission_rate?: number;
  status: string;
  fuel_types?: string[];
  fuel_prices?: Record<string, number>;
  fuel_brand?: string;
  other_offerings?: OtherOfferings;
  created_at: string;
  local_account_number?: string;
  local_monthly_spend_limit?: number;
  hasAccount?: boolean;
}

interface ClientGaragesViewProps {
  onNavigate?: (view: string | null) => void;
}

export default function ClientGaragesView({ onNavigate }: ClientGaragesViewProps = {}) {
  const [garages, setGarages] = useState<Garage[]>([]);
  const [filteredGarages, setFilteredGarages] = useState<Garage[]>([]);
  const [selectedGarage, setSelectedGarage] = useState<Garage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fuelTypeFilter, setFuelTypeFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');

  const formatOfferingName = (key: string): string => {
    const nameMap: Record<string, string> = {
      convenience_shop: 'Convenience Shop',
      branded_convenience_store: 'Branded Convenience Store',
      takeaways: 'Takeaways',
      branded_takeaways: 'Branded Takeaways',
      specialty_offering: 'Specialty Offering',
      lpg_gas: 'LPG Gas',
      paraffin: 'Paraffin',
      other: 'Other'
    };
    return nameMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getOfferingsToDisplay = (offerings?: OtherOfferings): Array<{ label: string; detail?: string }> => {
    if (!offerings) return [];

    const result: Array<{ label: string; detail?: string }> = [];

    const orderedKeys = [
      'convenience_shop',
      'branded_convenience_store',
      'takeaways',
      'branded_takeaways',
      'specialty_offering',
      'lpg_gas',
      'paraffin',
      'other'
    ];

    orderedKeys.forEach((key) => {
      const value = offerings[key as keyof OtherOfferings];
      if (typeof value === 'boolean' && value) {
        result.push({ label: formatOfferingName(key) });
      } else if (typeof value === 'object' && value.enabled) {
        result.push({
          label: formatOfferingName(key),
          detail: value.name
        });
      }
    });

    return result;
  };

  useEffect(() => {
    loadGarages();
  }, []);

  useEffect(() => {
    let filtered = garages;

    if (searchTerm) {
      filtered = filtered.filter((garage) => {
        const term = searchTerm.toLowerCase();
        const contactMatch = garage.contact_person?.toLowerCase().includes(term) ||
          garage.contact_persons?.some(contact =>
            contact.name?.toLowerCase().includes(term) ||
            contact.surname?.toLowerCase().includes(term) ||
            contact.email?.toLowerCase().includes(term) ||
            contact.mobile_phone?.includes(term)
          );

        return (
          garage.name?.toLowerCase().includes(term) ||
          garage.address_line_1?.toLowerCase().includes(term) ||
          (garage.address_line_2 && garage.address_line_2.toLowerCase().includes(term)) ||
          (garage.city && garage.city.toLowerCase().includes(term)) ||
          (garage.province && garage.province.toLowerCase().includes(term)) ||
          contactMatch
        );
      });
    }

    if (fuelTypeFilter) {
      filtered = filtered.filter((garage) => {
        return garage.fuel_types?.includes(fuelTypeFilter);
      });
    }

    if (serviceFilter) {
      filtered = filtered.filter((garage) => {
        if (!garage.other_offerings) return false;

        const offerings = garage.other_offerings;
        const value = offerings[serviceFilter as keyof OtherOfferings];

        if (typeof value === 'boolean') {
          return value === true;
        }
        if (typeof value === 'object' && value !== null) {
          return value.enabled === true;
        }
        return false;
      });
    }

    setFilteredGarages(filtered);
  }, [searchTerm, fuelTypeFilter, serviceFilter, garages]);

  const loadGarages = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        throw new Error('Organization not found');
      }

      const { data: garageAccounts, error: accountsError } = await supabase
        .from('organization_garage_accounts')
        .select('garage_id, account_number, monthly_spend_limit')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true);

      if (accountsError) throw accountsError;

      const garageIds = garageAccounts?.map(account => account.garage_id) || [];

      const { data, error: fetchError } = await supabase
        .from('garages')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (fetchError) throw fetchError;

      const garagesWithAccountInfo = (data || []).map(garage => {
        const accountInfo = garageAccounts?.find(acc => acc.garage_id === garage.id);
        const hasAccount = garageIds.includes(garage.id);
        return {
          ...garage,
          local_account_number: accountInfo?.account_number,
          local_monthly_spend_limit: accountInfo?.monthly_spend_limit,
          hasAccount,
        };
      });

      setGarages(garagesWithAccountInfo);
      setFilteredGarages(garagesWithAccountInfo);
    } catch (err: any) {
      console.error('Error loading garages:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openInMaps = (location: string) => {
    const encodedLocation = encodeURIComponent(location);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedLocation}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (selectedGarage) {
    return (
      <div className="py-6 space-y-6">
        <button
          onClick={() => setSelectedGarage(null)}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Garages
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Store className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{selectedGarage.name}</h2>
              <button
                onClick={() => {
                  const fullAddress = [
                    selectedGarage.address_line_1,
                    selectedGarage.address_line_2,
                    selectedGarage.city,
                    selectedGarage.province,
                    selectedGarage.postal_code,
                    'South Africa'
                  ].filter(field => field && field.trim() !== '').join(', ');
                  openInMaps(fullAddress);
                }}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 mt-2 transition-colors"
                title="Open in Google Maps"
              >
                <MapPin className="w-5 h-5" />
                <span className="hover:underline">
                  {[
                    selectedGarage.address_line_1,
                    selectedGarage.address_line_2,
                    selectedGarage.city,
                    selectedGarage.province,
                    selectedGarage.postal_code
                  ].filter(field => field && field.trim() !== '').join(', ')}
                </span>
              </button>
            </div>
          </div>

          {(selectedGarage.local_account_number || selectedGarage.local_monthly_spend_limit) && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Local Account Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedGarage.local_account_number && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Account Number</label>
                    <p className="text-gray-900 font-semibold mt-1">{selectedGarage.local_account_number}</p>
                  </div>
                )}
                {selectedGarage.local_monthly_spend_limit && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Monthly Spend Limit</label>
                    <p className="text-gray-900 font-semibold mt-1">R {selectedGarage.local_monthly_spend_limit.toFixed(2)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedGarage.fuel_types && selectedGarage.fuel_types.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Available Fuel Types & Prices</h3>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                {sortFuelTypes(selectedGarage.fuel_types).map((fuelType) => (
                  <div key={fuelType} className="flex flex-col gap-1 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="text-xs font-medium text-blue-900">{getFuelTypeDisplayName(fuelType)}</span>
                    {selectedGarage.fuel_prices && selectedGarage.fuel_prices[fuelType] ? (
                      <span className="text-sm font-bold text-blue-700">
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

          {(() => {
            const offeringsToDisplay = getOfferingsToDisplay(selectedGarage.other_offerings);
            return offeringsToDisplay.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Other Services & Offerings</h3>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {offeringsToDisplay.map((offering, index) => (
                    <div key={index} className="flex flex-col gap-1 px-4 py-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                        <span className="text-sm font-medium text-green-900">{offering.label}</span>
                      </div>
                      {offering.detail && (
                        <span className="text-xs text-green-700 ml-4 italic">{offering.detail}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Information</h3>
              {selectedGarage.contact_persons && selectedGarage.contact_persons.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedGarage.contact_persons.slice(0, 2).map((contact, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="font-medium text-gray-900 mb-3">{contact.name} {contact.surname}</div>
                      <div className="space-y-2">
                        {contact.mobile_phone && (
                          <div>
                            <label className="text-xs font-medium text-gray-600">Mobile Phone</label>
                            <div className="flex items-center gap-2 mt-1">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <a
                                href={`tel:${contact.mobile_phone}`}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                {contact.mobile_phone}
                              </a>
                            </div>
                          </div>
                        )}
                        {contact.email && (
                          <div>
                            <label className="text-xs font-medium text-gray-600">Email</label>
                            <div className="flex items-center gap-2 mt-1">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <a
                                href={`mailto:${contact.email}`}
                                className="text-blue-600 hover:text-blue-800 break-all text-sm"
                              >
                                {contact.email}
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Contact Person</label>
                    <p className="text-gray-900 mt-1">{selectedGarage.contact_person}</p>
                  </div>

                  {selectedGarage.contact_phone && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Phone</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <a
                          href={`tel:${selectedGarage.contact_phone}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {selectedGarage.contact_phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {selectedGarage.contact_email && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Email</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <a
                          href={`mailto:${selectedGarage.contact_email}`}
                          className="text-blue-600 hover:text-blue-800 break-all"
                        >
                          {selectedGarage.contact_email}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Banking Details</h3>
              {selectedGarage.bank_name ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    {selectedGarage.account_holder && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Account Holder</label>
                        <p className="text-gray-900 mt-1">{selectedGarage.account_holder}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-gray-600">Account Number</label>
                      <p className="text-gray-900 mt-1">{selectedGarage.account_number}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Bank Name</label>
                      <p className="text-gray-900 mt-1">{selectedGarage.bank_name}</p>
                    </div>
                    {selectedGarage.branch_code && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Branch Code</label>
                        <p className="text-gray-900 mt-1">{selectedGarage.branch_code}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 italic text-sm">No banking details available</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Garages Directory</h2>
        {onNavigate && (
          <button
            onClick={() => onNavigate(null)}
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 px-4 py-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Main Menu
          </button>
        )}
      </div>

      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search garages by name, location, or contact person..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Fuel Type</label>
            <select
              value={fuelTypeFilter}
              onChange={(e) => setFuelTypeFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">All Fuel Types</option>
              <option value="ULP-93">Unleaded Petrol 93 (ULP-93)</option>
              <option value="ULP-95">Unleaded Petrol 95 (ULP-95)</option>
              <option value="Diesel-10">Diesel 10 ppm Sulphur</option>
              <option value="Diesel-50">Diesel 50 ppm Sulphur</option>
              <option value="Diesel-500">Diesel 500 ppm Sulphur</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Service</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">All Services</option>
              <option value="convenience_shop">Convenience Shop</option>
              <option value="branded_convenience_store">Branded Convenience Store</option>
              <option value="takeaways">Takeaways</option>
              <option value="branded_takeaways">Branded Takeaways</option>
              <option value="specialty_offering">Specialty Offering</option>
              <option value="lpg_gas">LPG Gas</option>
              <option value="paraffin">Paraffin</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {(searchTerm || fuelTypeFilter || serviceFilter) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Showing {filteredGarages.length} of {garages.length} garages</span>
            <button
              onClick={() => {
                setSearchTerm('');
                setFuelTypeFilter('');
                setServiceFilter('');
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">All Registered Garages</p>
              <p>All garages registered in the system are shown below and are available for your drivers to use.</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="grid gap-4 grid-cols-1">
          {filteredGarages.map((garage) => (
            <button
              key={garage.id}
              onClick={() => setSelectedGarage(garage)}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all text-left"
            >
              <div className="flex flex-nowrap items-start gap-4">
                <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0 self-start">
                  <Store className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-lg">{garage.name}</h3>
                    {garage.hasAccount ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        Active Account
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                        No Account
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-gray-600 text-sm mt-1">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">
                      {[garage.address_line_1, garage.address_line_2, garage.city, garage.postal_code].filter(field => field && field.trim() !== '').join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      <span>{garage.contact_persons?.[0]?.mobile_phone || garage.contact_phone || 'N/A'}</span>
                    </div>
                    <div>Contact: {garage.contact_persons?.[0] ? `${garage.contact_persons[0].name} ${garage.contact_persons[0].surname}` : garage.contact_person}</div>
                  </div>
                  {garage.local_account_number && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-amber-100 border border-amber-300 rounded-lg">
                      <span className="text-xs font-medium text-amber-900">
                        Your Account: {garage.local_account_number}
                      </span>
                      {garage.local_monthly_spend_limit && (
                        <span className="text-xs text-amber-700">
                          • Limit: R{garage.local_monthly_spend_limit.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {garage.fuel_types && garage.fuel_types.length > 0 && (
                  <div className="flex-shrink-0 space-y-1.5 w-[200px] self-start">
                    {['ULP-93', 'ULP-95', 'Diesel-10', 'Diesel-50', 'Diesel-500']
                      .filter(fuelType => garage.fuel_types?.includes(fuelType))
                      .map((fuelType) => (
                      <div key={fuelType} className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                        <span className="text-sm font-medium text-blue-900">{fuelType}</span>
                        {garage.fuel_prices && garage.fuel_prices[fuelType] ? (
                          <span className="text-sm font-semibold text-blue-700">
                            R{garage.fuel_prices[fuelType].toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 italic">N/A</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))}

          {filteredGarages.length === 0 && (
            <div className="text-center py-12">
              <Store className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">
                {searchTerm ? 'No garages found matching your search' : 'No garages registered yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
