import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Phone, Mail, ChevronDown, ChevronUp, Fuel, Navigation, Wrench, User, Smartphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getFuelTypeDisplayName, sortFuelTypes } from '../lib/fuelTypes';

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
  province: string;
  postal_code: string;
  contact_phone: string;
  email_address: string;
  commission_rate: number;
  status: string;
  fuel_types: string[];
  fuel_prices: Record<string, number>;
  fuel_brand?: string;
  other_offerings?: OtherOfferings;
  contact_persons?: ContactPerson[];
  latitude?: number;
  longitude?: number;
  distance?: number;
  hasAccount?: boolean;
}

interface MobileGarageDirectoryProps {
  onBack: () => void;
  organizationId?: string;
}

export default function MobileGarageDirectory({ onBack, organizationId }: MobileGarageDirectoryProps) {
  const [garages, setGarages] = useState<Garage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGarageId, setExpandedGarageId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    loadGarages();
  }, [organizationId]);

  const loadGarages = async () => {
    setLoading(true);

    if (organizationId) {
      // For drivers: show all garages, mark which ones have accounts
      const [garagesResult, accountsResult] = await Promise.all([
        supabase
          .from('garages')
          .select('*')
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('organization_garage_accounts')
          .select('garage_id')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
      ]);

      if (garagesResult.data) {
        const accountGarageIds = accountsResult.data?.map(acc => acc.garage_id) || [];
        const allGarages = garagesResult.data.map(garage => ({
          ...garage,
          hasAccount: accountGarageIds.includes(garage.id)
        }));
        setGarages(allGarages);
      }
    } else {
      // For non-drivers: show all active garages
      const { data: garagesData } = await supabase
        .from('garages')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (garagesData) {
        setGarages(garagesData);
      }
    }

    setLoading(false);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationError(null);
        setSortByDistance(true);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location permission denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location information unavailable');
            break;
          case error.TIMEOUT:
            setLocationError('Location request timed out');
            break;
          default:
            setLocationError('An unknown error occurred');
        }
      }
    );
  };

  const filteredGarages = garages
    .filter(garage => {
      const term = searchTerm.toLowerCase();

      const nameMatch = garage.name.toLowerCase().includes(term);
      const cityMatch = garage.city.toLowerCase().includes(term);
      const provinceMatch = garage.province.toLowerCase().includes(term);
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

      return nameMatch || cityMatch || provinceMatch || brandMatch || offeringsMatch;
    })
    .map(garage => {
      if (userLocation && garage.latitude && garage.longitude) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          garage.latitude,
          garage.longitude
        );
        return { ...garage, distance };
      }
      return garage;
    })
    .sort((a, b) => {
      if (sortByDistance && a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="hover:bg-blue-700 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Garage Directory</h1>
            <p className="text-sm text-blue-100">Find Participating Garages</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        <div className="mb-4 space-y-3">
          <input
            type="text"
            placeholder="Search by name, city, brand, or offerings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border-2 border-gray-300 rounded-lg px-4 py-4 text-base bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            style={{ fontSize: '16px', minHeight: '50px' }}
          />

          <div className="flex gap-2">
            {!userLocation ? (
              <button
                onClick={getUserLocation}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                Find Nearest Garages
              </button>
            ) : (
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setSortByDistance(false)}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    !sortByDistance
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Sort by Name
                </button>
                <button
                  onClick={() => setSortByDistance(true)}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    sortByDistance
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Navigation className="w-4 h-4" />
                  Sort by Distance
                </button>
              </div>
            )}
          </div>

          {locationError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {locationError}
            </div>
          )}
        </div>

        {organizationId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Garage Directory</p>
              <p>All registered garages are shown. Garages marked as "Active" have accounts set up for your organization. Contact your administrator to set up new garage accounts.</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading garages...</p>
          </div>
        ) : filteredGarages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No garages found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGarages.map((garage) => {
              const isExpanded = expandedGarageId === garage.id;
              return (
                <button
                  key={garage.id}
                  onClick={() => setExpandedGarageId(isExpanded ? null : garage.id)}
                  className="w-full bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-gray-900">{garage.name}</h3>
                        {organizationId && (
                          garage.hasAccount ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                              Not Setup
                            </span>
                          )
                        )}
                      </div>
                      {garage.fuel_brand && (
                        <div className="text-xs font-medium text-blue-600 mb-1">
                          {garage.fuel_brand}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <p>{garage.city}, {garage.province}</p>
                      </div>

                      {garage.distance !== undefined && (
                        <div className="flex items-center gap-2 text-sm text-blue-600 font-medium mb-2">
                          <Navigation className="w-4 h-4 flex-shrink-0" />
                          <p>{garage.distance.toFixed(1)} km away</p>
                        </div>
                      )}

                      {garage.fuel_types && garage.fuel_types.length > 0 && (
                        <div className="space-y-1 mt-2">
                          {sortFuelTypes(garage.fuel_types).map((fuelType) => (
                            <div key={fuelType} className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">{getFuelTypeDisplayName(fuelType)}</span>
                              {garage.fuel_prices && garage.fuel_prices[fuelType] && (
                                <span className="font-medium text-gray-900 ml-2">
                                  R {garage.fuel_prices[fuelType].toFixed(2)}/L
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-3 pt-4 border-t border-gray-200">
                      <div
                        className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer hover:text-blue-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          const address = `${garage.address_line_1}${garage.address_line_2 ? ', ' + garage.address_line_2 : ''}, ${garage.city}, ${garage.province} ${garage.postal_code}`;
                          const encodedAddress = encodeURIComponent(address);
                          window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
                        }}
                      >
                        <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p>{garage.address_line_1}</p>
                          {garage.address_line_2 && <p>{garage.address_line_2}</p>}
                          <p>{garage.city}, {garage.province} {garage.postal_code}</p>
                        </div>
                      </div>

                      {garage.contact_phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4 flex-shrink-0" />
                          <a
                            href={`tel:${garage.contact_phone}`}
                            className="hover:text-blue-600"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {garage.contact_phone}
                          </a>
                        </div>
                      )}

                      {garage.email_address && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <a
                            href={`mailto:${garage.email_address}`}
                            className="hover:text-blue-600"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {garage.email_address}
                          </a>
                        </div>
                      )}

                      {garage.fuel_types && garage.fuel_types.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Fuel className="w-4 h-4 text-gray-700" />
                            <p className="text-sm font-medium text-gray-700">Available Fuel Types</p>
                          </div>
                          <div className="ml-6 space-y-1">
                            {sortFuelTypes(garage.fuel_types).map((fuelType) => (
                              <div key={fuelType} className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{getFuelTypeDisplayName(fuelType)}</span>
                                {garage.fuel_prices && garage.fuel_prices[fuelType] && (
                                  <span className="font-medium text-gray-900">
                                    R {garage.fuel_prices[fuelType].toFixed(2)}/L
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {garage.other_offerings && Object.keys(garage.other_offerings).length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Wrench className="w-4 h-4 text-gray-700" />
                            <p className="text-sm font-medium text-gray-700">Other Offerings</p>
                          </div>
                          <div className="ml-6 space-y-2">
                            {garage.other_offerings.convenience_shop && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                <span>Convenience Shop</span>
                              </div>
                            )}
                            {garage.other_offerings.branded_convenience_store?.enabled && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                <span>Branded Convenience Store: {garage.other_offerings.branded_convenience_store.name}</span>
                              </div>
                            )}
                            {garage.other_offerings.takeaways && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                <span>Takeaways</span>
                              </div>
                            )}
                            {garage.other_offerings.branded_takeaways?.enabled && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                <span>Branded Takeaways: {garage.other_offerings.branded_takeaways.name}</span>
                              </div>
                            )}
                            {garage.other_offerings.specialty_offering?.enabled && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                <span>Specialty Offering: {garage.other_offerings.specialty_offering.name}</span>
                              </div>
                            )}
                            {garage.other_offerings.lpg_gas && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                <span>LPG Gas</span>
                              </div>
                            )}
                            {garage.other_offerings.paraffin && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                <span>Paraffin</span>
                              </div>
                            )}
                            {garage.other_offerings.other?.enabled && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                <span>Other: {garage.other_offerings.other.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {garage.contact_persons && garage.contact_persons.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-gray-700" />
                            <p className="text-sm font-medium text-gray-700">Contact Persons</p>
                          </div>
                          <div className="ml-6 space-y-3">
                            {garage.contact_persons.map((contact, index) => (
                              <div key={index} className="text-sm text-gray-600">
                                <p className="font-medium text-gray-700">
                                  {contact.name} {contact.surname}
                                  {contact.is_primary && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Primary</span>}
                                </p>
                                <div className="ml-4 mt-1 space-y-1">
                                  {contact.email && (
                                    <div className="flex items-center gap-2">
                                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                                      <a
                                        href={`mailto:${contact.email}`}
                                        className="hover:text-blue-600"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {contact.email}
                                      </a>
                                    </div>
                                  )}
                                  {contact.phone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                                      <a
                                        href={`tel:${contact.phone}`}
                                        className="hover:text-blue-600"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {contact.phone}
                                      </a>
                                    </div>
                                  )}
                                  {contact.mobile_phone && (
                                    <div className="flex items-center gap-2">
                                      <Smartphone className="w-3.5 h-3.5 text-gray-400" />
                                      <a
                                        href={`tel:${contact.mobile_phone}`}
                                        className="hover:text-blue-600"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {contact.mobile_phone}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
