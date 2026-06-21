import { useState, useEffect } from 'react';
import { Calendar, Download, FileText, TrendingUp, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface TripRecord {
  vehicle_id: string;
  vehicle_registration: string;
  vehicle_make: string;
  vehicle_model: string;
  driver_id: string;
  driver_name: string;
  draw_time: string;
  draw_odometer: number;
  return_time: string | null;
  return_odometer: number | null;
  km_travelled: number | null;
  trip_description: string | null;
  return_notes: string | null;
  status: 'in_progress' | 'completed';
}

interface DailyTripReportProps {
  organizationId?: string;
}

export default function DailyTripReport({ organizationId: propOrgId }: DailyTripReportProps) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalKm, setTotalKm] = useState(0);
  const [organizationId, setOrganizationId] = useState<string | null>(propOrgId || null);

  useEffect(() => {
    loadOrganizationId();
  }, [propOrgId]);

  useEffect(() => {
    if (organizationId) {
      loadTripData();
    }
  }, [selectedDate, organizationId]);

  const loadOrganizationId = async () => {
    if (propOrgId) {
      setOrganizationId(propOrgId);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id);
      }
    }
  };

  const loadTripData = async () => {
    if (!organizationId) return;

    setLoading(true);
    setError('');
    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: draws, error: drawError } = await supabase
        .from('vehicle_transactions')
        .select(`
          id,
          vehicle_id,
          driver_id,
          odometer_reading,
          created_at,
          trip_description,
          vehicles (
            registration_number,
            make,
            model
          ),
          drivers (
            first_name,
            surname
          )
        `)
        .eq('organization_id', organizationId)
        .eq('transaction_type', 'draw')
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: true });

      if (drawError) throw drawError;

      const tripRecords: TripRecord[] = [];
      let totalKmTravelled = 0;

      // Track the most recent unreturned draw per vehicle
      const vehicleLatestUnreturnedDraw = new Map<string, { id: string; created_at: string }>();

      for (const draw of draws || []) {
        const { data: returnData } = await supabase
          .from('vehicle_transactions')
          .select('odometer_reading, created_at, notes')
          .eq('related_transaction_id', draw.id)
          .eq('transaction_type', 'return')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!returnData) {
          const existing = vehicleLatestUnreturnedDraw.get(draw.vehicle_id);
          if (!existing || new Date(draw.created_at) > new Date(existing.created_at)) {
            vehicleLatestUnreturnedDraw.set(draw.vehicle_id, {
              id: draw.id,
              created_at: draw.created_at
            });
          }
        }
      }

      for (const draw of draws || []) {
        const drawDate = new Date(draw.created_at);
        const { data: returnData } = await supabase
          .from('vehicle_transactions')
          .select('odometer_reading, created_at, notes')
          .eq('related_transaction_id', draw.id)
          .eq('transaction_type', 'return')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        const drawnOnSelectedDate = drawDate >= startOfDay && drawDate <= endOfDay;
        const isInProgress = !returnData;
        const returnedOnSelectedDate = returnData && new Date(returnData.created_at) >= startOfDay && new Date(returnData.created_at) <= endOfDay;
        const returnedAfterSelectedDate = returnData && new Date(returnData.created_at) > endOfDay;

        // Only show unreturned draws if they are the most recent for that vehicle
        const isLatestUnreturnedForVehicle = isInProgress && vehicleLatestUnreturnedDraw.get(draw.vehicle_id)?.id === draw.id;

        if (drawnOnSelectedDate || isLatestUnreturnedForVehicle || returnedOnSelectedDate || returnedAfterSelectedDate) {
          const kmTravelled = returnData
            ? returnData.odometer_reading - draw.odometer_reading
            : null;

          if (kmTravelled !== null) {
            totalKmTravelled += kmTravelled;
          }

          tripRecords.push({
            vehicle_id: draw.vehicle_id,
            vehicle_registration: draw.vehicles?.registration_number || 'Unknown',
            vehicle_make: draw.vehicles?.make || '',
            vehicle_model: draw.vehicles?.model || '',
            driver_id: draw.driver_id,
            driver_name: `${draw.drivers?.first_name || ''} ${draw.drivers?.surname || ''}`.trim(),
            draw_time: draw.created_at,
            draw_odometer: draw.odometer_reading,
            return_time: returnData?.created_at || null,
            return_odometer: returnData?.odometer_reading || null,
            km_travelled: kmTravelled,
            trip_description: draw.trip_description,
            return_notes: returnData?.notes || null,
            status: returnData ? 'completed' : 'in_progress',
          });
        }
      }

      setTrips(tripRecords);
      setTotalKm(totalKmTravelled);
    } catch (err: any) {
      setError(err.message || 'Failed to load trip data');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const worksheetData = trips.map(trip => ({
      'Vehicle': trip.vehicle_registration,
      'Make': trip.vehicle_make,
      'Model': trip.vehicle_model,
      'Driver': trip.driver_name,
      'Draw Date': new Date(trip.draw_time).toLocaleDateString('en-GB'),
      'Draw Time': new Date(trip.draw_time).toLocaleTimeString('en-GB'),
      'Draw Odometer (km)': trip.draw_odometer,
      'Return Time': trip.return_time ? new Date(trip.return_time).toLocaleString('en-GB') : 'Not returned',
      'Return Odometer (km)': trip.return_odometer || '-',
      'KM Travelled': trip.km_travelled || '-',
      'Trip Description': trip.trip_description || '-',
      'Return Notes': trip.return_notes || '-',
      'Status': trip.status === 'completed' ? 'Completed' : 'In Progress',
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Trips');

    const fileName = `Daily_Trip_Report_${selectedDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-GB'),
      time: date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">Daily Trip Report</h2>
          </div>
          <button
            onClick={exportToExcel}
            disabled={trips.length === 0}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-5 h-5" />
            Export to Excel
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full md:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-2">Loading trip data...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && trips.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No trips found for {new Date(selectedDate).toLocaleDateString('en-GB')}</p>
          </div>
        )}

        {!loading && !error && trips.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-blue-700">Total Trips</p>
                    <p className="text-2xl font-bold text-blue-900">{trips.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-sm text-green-700">Total KM Travelled</p>
                    <p className="text-2xl font-bold text-green-900">{totalKm.toLocaleString()} km</p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                  <div>
                    <p className="text-sm text-amber-700">In Progress</p>
                    <p className="text-2xl font-bold text-amber-900">
                      {trips.filter(t => t.status === 'in_progress').length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Draw Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return Time</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">KM Travelled</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trip Details</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {trips.map((trip, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{trip.vehicle_registration}</p>
                          <p className="text-xs text-gray-500">{trip.vehicle_make} {trip.vehicle_model}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trip.driver_name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          {(() => {
                            const drawDateTime = new Date(trip.draw_time);
                            const selectedDateTime = new Date(selectedDate);
                            const isSameDay = drawDateTime.toDateString() === selectedDateTime.toDateString();

                            if (!isSameDay) {
                              return (
                                <>
                                  <p className="text-sm text-gray-900">{formatDateTime(trip.draw_time).date}</p>
                                  <p className="text-xs text-gray-600">{formatDateTime(trip.draw_time).time}</p>
                                </>
                              );
                            } else {
                              return <p className="text-sm text-gray-900">{formatTime(trip.draw_time)}</p>;
                            }
                          })()}
                          <p className="text-xs text-gray-500">{trip.draw_odometer.toLocaleString()} km</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {trip.return_time ? (
                          <div>
                            {(() => {
                              const returnDateTime = new Date(trip.return_time);
                              const selectedDateTime = new Date(selectedDate);
                              const isSameDay = returnDateTime.toDateString() === selectedDateTime.toDateString();

                              if (!isSameDay) {
                                return (
                                  <>
                                    <p className="text-sm text-gray-900">{formatDateTime(trip.return_time).date}</p>
                                    <p className="text-xs text-gray-600">{formatDateTime(trip.return_time).time}</p>
                                  </>
                                );
                              } else {
                                return <p className="text-sm text-gray-900">{formatTime(trip.return_time)}</p>;
                              }
                            })()}
                            <p className="text-xs text-gray-500">{trip.return_odometer?.toLocaleString()} km</p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        {trip.km_travelled !== null ? (
                          <span className="text-sm font-semibold text-gray-900">
                            {trip.km_travelled.toLocaleString()} km
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 max-w-xs">
                        <div className="space-y-1">
                          {trip.trip_description && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-0.5">Trip:</p>
                              <p className="text-sm text-gray-900" title={trip.trip_description}>
                                {trip.trip_description}
                              </p>
                            </div>
                          )}
                          {trip.return_notes && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-0.5">Notes:</p>
                              <p className="text-sm text-gray-900" title={trip.return_notes}>
                                {trip.return_notes}
                              </p>
                            </div>
                          )}
                          {!trip.trip_description && !trip.return_notes && (
                            <span className="text-gray-400 italic">No details</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        {trip.status === 'completed' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            In Progress
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
