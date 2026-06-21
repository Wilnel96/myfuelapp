import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getFuelTypeDisplayName, sortFuelTypes } from '../lib/fuelTypes';
import { Store, Search, MapPin, Phone, Mail, AlertCircle } from 'lucide-react';

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
  created_at: string;
  fuel_types?: string[];
  fuel_prices?: Record<string, number>;
  fuel_brand?: string;
  other_offerings?: OtherOfferings;
  price_zone?: string;
}

export default function GaragesDirectory() {
  const [garages, setGarages] = useState<Garage[]>([]);
  const [filteredGarages, setFilteredGarages] = useState<Garage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadGarages();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = garages.filter((garage) => {
        const term = searchTerm.toLowerCase();

        const nameMatch = garage.name.toLowerCase().includes(term);
        const addressMatch = garage.address_line_1.toLowerCase().includes(term);
        const address2Match = garage.address_line_2 && garage.address_line_2.toLowerCase().includes(term);
        const cityMatch = garage.city && garage.city.toLowerCase().includes(term);
        const provinceMatch = garage.province && garage.province.toLowerCase().includes(term);

        const contactMatch = garage.contact_person?.toLowerCase().includes(term) ||
          garage.contact_persons?.some(contact =>
            contact.name.toLowerCase().includes(term) ||
            contact.surname.toLowerCase().includes(term) ||
            contact.email.toLowerCase().includes(term) ||
            contact.mobile_phone.includes(term)
          );

        const brandMatch = (garage.fuel_brand || '').toLowerCase().includes(term);

        let offeringsMatch = false;
        if (garage.other_offerings) {
          const offerings = garage.other_offerings;
          offeringsMatch =
            (offerings.branded_convenience_store?.enabled && offerings.branded_convenience_store.name.toLowerCase().includes(term)) ||
            (offerings.branded_takeaways?.enabled && offerings.branded_takeaways.name.toLowerCase().includes(term)) ||
            (offerings.specialty_offering?.enabled && offerings.specialty_offering.name.toLowerCase().includes(term)) ||
            (offerings.other?.enabled && offerings.other.name.toLowerCase().includes(term)) ||
            (offerings.convenience_shop && 'convenience'.includes(term)) ||
            (offerings.takeaways && 'takeaway'.includes(term)) ||
            (offerings.lpg_gas && 'lpg'.includes(term)) ||
            (offerings.paraffin && 'paraffin'.includes(term));
        }

        return nameMatch || addressMatch || address2Match || cityMatch || provinceMatch || contactMatch || brandMatch || offeringsMatch;
      });
      setFilteredGarages(filtered);
    } else {
      setFilteredGarages(garages);
    }
  }, [searchTerm, garages]);

  const loadGarages = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('garages')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;
      setGarages(data || []);
      setFilteredGarages(data || []);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Store className="w-6 h-6 text-gray-700" />
          <h1 className="text-xl font-bold text-gray-900">Garages Directory</h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search garages by name, location, brand, or offerings..."
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

      <div className="grid gap-4 grid-cols-1">
        {filteredGarages.map((garage) => (
          <div
            key={garage.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex flex-nowrap items-start gap-4">
              <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0 self-start">
                <Store className="w-6 h-6 text-blue-600" />
              </div>

              <div className="flex-1 overflow-hidden">
                <h3 className="font-semibold text-gray-900 text-lg">{garage.name}</h3>
                <button
                  onClick={() => {
                    const fullAddress = [
                      garage.address_line_1,
                      garage.address_line_2,
                      garage.city,
                      garage.province,
                      garage.postal_code,
                      'South Africa'
                    ].filter(field => field && field.trim() !== '').join(', ');
                    openInMaps(fullAddress);
                  }}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm mt-1 transition-colors"
                  title="Open in Google Maps"
                >
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="hover:underline truncate">
                    {[
                      garage.address_line_1,
                      garage.address_line_2,
                      garage.city,
                      garage.province,
                      garage.postal_code
                    ].filter(field => field && field.trim() !== '').join(', ')}
                  </span>
                </button>

                <div className="space-y-3 text-sm mt-3">
                  {garage.contact_persons && garage.contact_persons.length > 0 ? (
                    <div>
                      <div className="font-medium text-gray-900 mb-2">Contact Persons</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {garage.contact_persons.slice(0, 2).map((contact, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="font-medium text-gray-900">{contact.name} {contact.surname}</div>
                            {contact.mobile_phone && (
                              <div className="flex items-center gap-2 text-gray-700 mt-1">
                                <Phone className="w-3.5 h-3.5 text-gray-400" />
                                <div className="text-sm">{contact.mobile_phone}</div>
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center gap-2 text-gray-700 mt-1">
                                <Mail className="w-3.5 h-3.5 text-gray-400" />
                                <div className="text-sm break-all">{contact.email}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-gray-700">
                        <div className="font-medium min-w-[100px]">Contact Person:</div>
                        <div>{garage.contact_person}</div>
                      </div>

                      {garage.contact_phone && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <div>{garage.contact_phone}</div>
                        </div>
                      )}

                      {garage.contact_email && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <div className="break-all">{garage.contact_email}</div>
                        </div>
                      )}
                    </>
                  )}

                  {garage.bank_name && (
                    <div className="pt-3 mt-3 border-t border-gray-200">
                      <div className="font-medium text-gray-900 mb-2">Banking Details</div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-gray-700">
                        {garage.account_holder && (
                          <>
                            <div className="font-medium text-gray-600">Account Holder:</div>
                            <div>{garage.account_holder}</div>
                          </>
                        )}
                        <div className="font-medium text-gray-600">Account Number:</div>
                        <div>{garage.account_number}</div>
                        <div className="font-medium text-gray-600">Bank Name:</div>
                        <div>{garage.bank_name}</div>
                        {garage.branch_code && (
                          <>
                            <div className="font-medium text-gray-600">Branch Code:</div>
                            <div>{garage.branch_code}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {garage.other_offerings && Object.keys(garage.other_offerings).length > 0 && (
                    <div className="pt-3 mt-3 border-t border-gray-200">
                      <div className="font-medium text-gray-900 mb-2">Other Offerings</div>
                      <div className="space-y-1.5">
                        {garage.other_offerings.convenience_shop && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span className="text-sm">Convenience Shop</span>
                          </div>
                        )}
                        {garage.other_offerings.branded_convenience_store?.enabled && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span className="text-sm">Branded Convenience Store: {garage.other_offerings.branded_convenience_store.name}</span>
                          </div>
                        )}
                        {garage.other_offerings.takeaways && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span className="text-sm">Takeaways</span>
                          </div>
                        )}
                        {garage.other_offerings.branded_takeaways?.enabled && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span className="text-sm">Branded Takeaways: {garage.other_offerings.branded_takeaways.name}</span>
                          </div>
                        )}
                        {garage.other_offerings.specialty_offering?.enabled && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span className="text-sm">Specialty Offering: {garage.other_offerings.specialty_offering.name}</span>
                          </div>
                        )}
                        {garage.other_offerings.lpg_gas && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span className="text-sm">LPG Gas</span>
                          </div>
                        )}
                        {garage.other_offerings.paraffin && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span className="text-sm">Paraffin</span>
                          </div>
                        )}
                        {garage.other_offerings.other?.enabled && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span className="text-sm">Other: {garage.other_offerings.other.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {garage.fuel_types && garage.fuel_types.length > 0 && (
                <div className="flex-shrink-0 space-y-1.5 w-[200px] self-start">
                  {sortFuelTypes(garage.fuel_types).map((fuelType) => (
                    <div key={fuelType} className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="text-sm font-medium text-blue-900">{getFuelTypeDisplayName(fuelType)}</span>
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
          </div>
        ))}
      </div>

      {filteredGarages.length === 0 && (
        <div className="text-center py-12">
          <Store className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            {searchTerm ? 'No garages found matching your search' : 'No garages registered yet'}
          </p>
        </div>
      )}
    </div>
  );
}
