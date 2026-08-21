import { useState, useEffect, useMemo } from 'react';
import { Calendar, Download, FileText, TrendingUp, AlertCircle, ChevronDown, ChevronRight, Mail, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import EmailReportModal from './EmailReportModal';

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
  trailer_registration: string | null;
  trailer_gvm: number | null;
}

interface DayGroup {
  date: string;
  trips: TripRecord[];
  totalKm: number;
  inProgress: number;
}

interface VehicleOption {
  id: string;
  registration_number: string;
  make: string;
  model: string;
}

interface DailyTripReportProps {
  organizationId?: string;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDisplayDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const e = new Date(end + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `From: ${s}  To: ${e}`;
}

function enumerateDays(start: string, end: string): string[] {
  const days: string[] = [];
  const startD = new Date(start + 'T00:00:00');
  const endD = new Date(end + 'T00:00:00');
  if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return days;
  if (startD > endD) return days;
  const cursor = new Date(startD);
  while (cursor <= endD) {
    days.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export default function DailyTripReport({ organizationId: propOrgId }: DailyTripReportProps) {
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState(monthAgo);
  const [endDate, setEndDate] = useState(today);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalKm, setTotalKm] = useState(0);
  const [organizationId, setOrganizationId] = useState<string | null>(propOrgId || null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  useEffect(() => {
    loadOrganizationId();
  }, [propOrgId]);

  useEffect(() => {
    if (organizationId) {
      loadTripData();
      loadVehicles();
    }
  }, [startDate, endDate, organizationId]);

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

  const loadVehicles = async () => {
    if (!organizationId) return;
    const { data } = await supabase
      .from('vehicles')
      .select('id, registration_number, make, model')
      .eq('organization_id', organizationId)
      .order('registration_number', { ascending: true });
    setVehicles(data || []);
  };

  const loadTripData = async () => {
    if (!organizationId) return;

    setLoading(true);
    setError('');
    try {
      const startDateTime = new Date(startDate + 'T00:00:00');
      const endDateTime = new Date(endDate + 'T23:59:59.999');

      let query = supabase
        .from('vehicle_transactions')
        .select(`
          id,
          vehicle_id,
          driver_id,
          odometer_reading,
          created_at,
          trip_description,
          trailer_id,
          vehicles (
            registration_number,
            make,
            model
          ),
          drivers (
            first_name,
            surname
          ),
          trailers (
            registration_number,
            gvm_weight
          )
        `)
        .eq('organization_id', organizationId)
        .eq('transaction_type', 'draw')
        .gte('created_at', startDateTime.toISOString())
        .lte('created_at', endDateTime.toISOString())
        .order('created_at', { ascending: true });

      if (selectedVehicleId !== 'all') {
        query = query.eq('vehicle_id', selectedVehicleId);
      }

      const { data: draws, error: drawError } = await query;

      if (drawError) throw drawError;

      const tripRecords: TripRecord[] = [];
      let totalKmTravelled = 0;

      for (const draw of draws || []) {
        const { data: returnData } = await supabase
          .from('vehicle_transactions')
          .select('odometer_reading, created_at, notes')
          .eq('related_transaction_id', draw.id)
          .eq('transaction_type', 'return')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

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
          trailer_registration: draw.trailers?.registration_number || null,
          trailer_gvm: draw.trailers?.gvm_weight || null,
        });
      }

      // Sort trips by vehicle registration, then by draw time
      tripRecords.sort((a, b) => {
        const regCompare = a.vehicle_registration.localeCompare(b.vehicle_registration);
        if (regCompare !== 0) return regCompare;
        return new Date(a.draw_time).getTime() - new Date(b.draw_time).getTime();
      });

      setTrips(tripRecords);
      setTotalKm(totalKmTravelled);

      // Auto-expand all days that have trips
      const dayKeys = new Set<string>();
      for (const trip of tripRecords) {
        const drawDate = new Date(trip.draw_time);
        dayKeys.add(formatDateKey(drawDate));
      }
      setExpandedDays(dayKeys);
    } catch (err: any) {
      setError(err.message || 'Failed to load trip data');
    } finally {
      setLoading(false);
    }
  };

  // Group trips by day; include all days in the range even if no trips
  const dayGroups: DayGroup[] = useMemo(() => {
    const allDays = enumerateDays(startDate, endDate);
    const tripsByDay = new Map<string, TripRecord[]>();

    for (const trip of trips) {
      const drawDate = new Date(trip.draw_time);
      const dayKey = formatDateKey(drawDate);
      if (!tripsByDay.has(dayKey)) {
        tripsByDay.set(dayKey, []);
      }
      tripsByDay.get(dayKey)!.push(trip);
    }

    return allDays.map((day) => {
      const dayTrips = tripsByDay.get(day) || [];
      const km = dayTrips.reduce((sum, t) => sum + (t.km_travelled || 0), 0);
      const inProg = dayTrips.filter((t) => t.status === 'in_progress').length;
      return { date: day, trips: dayTrips, totalKm: km, inProgress: inProg };
    });
  }, [trips, startDate, endDate]);

  const toggleDay = (day: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

  const selectedVehicleLabel = useMemo(() => {
    if (selectedVehicleId === 'all') return 'All Vehicles';
    const v = vehicles.find((v) => v.id === selectedVehicleId);
    return v ? `${v.registration_number} (${v.make} ${v.model})` : 'All Vehicles';
  }, [selectedVehicleId, vehicles]);

  const buildEmailCsv = (): string => {
    let csv = `MyFuelApp.net - Daily Trip Report\n${formatDisplayDateRange(startDate, endDate)}\nVehicle: ${selectedVehicleLabel}\nGenerated: ${new Date().toLocaleString('en-GB')}\n\n`;
    csv += 'Date,Vehicle,Make,Model,Driver,Draw Time,Draw Odometer,Return Time,Return Odometer,KM Travelled,Trailer,Trailer GVM,Trip Description,Return Notes,Status\n';

    for (const group of dayGroups) {
      if (group.trips.length === 0) {
        csv += `"${formatDisplayDate(group.date)}","No trips","","","","","","","","","","","","",""\n`;
      } else {
        for (const trip of group.trips) {
          csv += `"${formatDisplayDate(group.date)}","${trip.vehicle_registration}","${trip.vehicle_make}","${trip.vehicle_model}","${trip.driver_name}","${new Date(trip.draw_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}",${trip.draw_odometer},"${trip.return_time ? new Date(trip.return_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Not returned'}",${trip.return_odometer || ''},${trip.km_travelled !== null ? trip.km_travelled : ''},"${trip.trailer_registration || ''}","${trip.trailer_gvm || ''}","${(trip.trip_description || '').replace(/"/g, '""')}","${(trip.return_notes || '').replace(/"/g, '""')}",${trip.status === 'completed' ? 'Completed' : 'In Progress'}\n`;
        }
      }
    }

    csv += `\nTotal Trips,${trips.length}\nTotal KM,${totalKm.toLocaleString()}\n`;
    return csv;
  };

  const exportToExcel = () => {
    const worksheetData: any[] = [];

    worksheetData.push({
      'Vehicle': 'MyFuelApp.net - Daily Trip Report',
      'Make': '',
      'Model': '',
      'Driver': '',
      'Trailer': '',
      'Trailer GVM (kg)': '',
      'Draw Date': formatDisplayDateRange(startDate, endDate),
      'Draw Time': '',
      'Draw Odometer (km)': '',
      'Return Time': '',
      'Return Odometer (km)': '',
      'KM Travelled': '',
      'Trip Description': '',
      'Return Notes': '',
      'Status': selectedVehicleLabel,
    });
    worksheetData.push({});

    for (const group of dayGroups) {
      worksheetData.push({
        'Vehicle': formatDisplayDate(group.date),
        'Make': `${group.trips.length} trip(s)`,
        'Model': `${group.totalKm.toLocaleString()} km`,
        'Driver': group.inProgress > 0 ? `${group.inProgress} in progress` : '',
        'Trailer': '',
        'Trailer GVM (kg)': '',
        'Draw Date': '',
        'Draw Time': '',
        'Draw Odometer (km)': '',
        'Return Time': '',
        'Return Odometer (km)': '',
        'KM Travelled': '',
        'Trip Description': '',
        'Return Notes': '',
        'Status': '',
      });

      if (group.trips.length === 0) {
        worksheetData.push({
          'Vehicle': 'No trips', 'Make': '', 'Model': '', 'Driver': '', 'Trailer': '', 'Trailer GVM (kg)': '',
          'Draw Date': '', 'Draw Time': '', 'Draw Odometer (km)': '', 'Return Time': '', 'Return Odometer (km)': '',
          'KM Travelled': '', 'Trip Description': '', 'Return Notes': '', 'Status': '',
        });
      } else {
        for (const trip of group.trips) {
          worksheetData.push({
            'Vehicle': trip.vehicle_registration,
            'Make': trip.vehicle_make,
            'Model': trip.vehicle_model,
            'Driver': trip.driver_name,
            'Trailer': trip.trailer_registration || '-',
            'Trailer GVM (kg)': trip.trailer_gvm || '-',
            'Draw Date': new Date(trip.draw_time).toLocaleDateString('en-GB'),
            'Draw Time': new Date(trip.draw_time).toLocaleTimeString('en-GB'),
            'Draw Odometer (km)': trip.draw_odometer,
            'Return Time': trip.return_time ? new Date(trip.return_time).toLocaleString('en-GB') : 'Not returned',
            'Return Odometer (km)': trip.return_odometer || '-',
            'KM Travelled': trip.km_travelled || '-',
            'Trip Description': trip.trip_description || '-',
            'Return Notes': trip.return_notes || '-',
            'Status': trip.status === 'completed' ? 'Completed' : 'In Progress',
          });
        }
      }
      worksheetData.push({});
    }

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Trips');

    const fileName = `Daily_Trip_Report_${startDate}_to_${endDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const completedCount = trips.filter((t) => t.status === 'completed').length;
  const inProgressCount = trips.filter((t) => t.status === 'in_progress').length;

  const dateRangeLabel = formatDisplayDateRange(startDate, endDate);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        {/* Report heading */}
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">MyFuelApp.net — Daily Trip Report</h1>
          <p className="text-sm text-gray-600 mt-1">{dateRangeLabel}</p>
          {selectedVehicleId !== 'all' && (
            <p className="text-sm text-gray-600">Vehicle: {selectedVehicleLabel}</p>
          )}
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
                className="w-full md:w-48 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                max={today}
                min={startDate}
                className="w-full md:w-48 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle</label>
            <div className="relative">
              <Truck className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={selectedVehicleId}
                onChange={(e) => {
                  setSelectedVehicleId(e.target.value);
                  setTimeout(() => loadTripData(), 0);
                }}
                className="w-full md:w-56 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="all">All Vehicles</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registration_number} ({v.make} {v.model})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setEmailModalOpen(true)}
              disabled={loading || dayGroups.length === 0}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Mail className="w-5 h-5" />
              Email
            </button>
            <button
              onClick={exportToExcel}
              disabled={loading || dayGroups.length === 0}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-5 h-5" />
              Export to Excel
            </button>
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

        {!loading && !error && (
          <>
            {trips.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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

                <div className="bg-emerald-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-emerald-600" />
                    <div>
                      <p className="text-sm text-emerald-700">Completed</p>
                      <p className="text-2xl font-bold text-emerald-900">{completedCount}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                    <div>
                      <p className="text-sm text-amber-700">In Progress</p>
                      <p className="text-2xl font-bold text-amber-900">{inProgressCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {dayGroups.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Select a valid date range to view trips</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dayGroups.map((group) => {
                  const isExpanded = expandedDays.has(group.date);
                  const hasTrips = group.trips.length > 0;
                  return (
                    <div key={group.date} className={`border rounded-lg overflow-hidden ${hasTrips ? 'border-gray-200' : 'border-gray-100'}`}>
                      <button
                        onClick={() => toggleDay(group.date)}
                        className={`w-full flex items-center justify-between px-5 py-4 ${hasTrips ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-50/50'} transition-colors`}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-500" />
                          )}
                          <div className="text-left">
                            <p className="text-sm font-semibold text-gray-900">{formatDisplayDate(group.date)}</p>
                            <p className="text-xs text-gray-500">
                              {hasTrips
                                ? `${group.trips.length} trip${group.trips.length !== 1 ? 's' : ''} · ${group.totalKm.toLocaleString()} km${group.inProgress > 0 ? ` · ${group.inProgress} in progress` : ''}`
                                : 'No trips'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasTrips && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {group.trips.length} trip{group.trips.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="bg-white">
                          {hasTrips ? (
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trailer</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Draw Time</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return Time</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">KM Travelled</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trip Details</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {group.trips.map((trip, index) => (
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
                                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                                        {trip.trailer_registration ? (
                                          <div>
                                            <p className="font-semibold text-gray-900">{trip.trailer_registration}</p>
                                            <p className="text-xs text-gray-500">{trip.trailer_gvm} kg</p>
                                          </div>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap">
                                        <div>
                                          <p className="text-sm text-gray-900">{formatTime(trip.draw_time)}</p>
                                          <p className="text-xs text-gray-500">{trip.draw_odometer.toLocaleString()} km</p>
                                        </div>
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap">
                                        {trip.return_time ? (
                                          <div>
                                            <p className="text-sm text-gray-900">{formatTime(trip.return_time)}</p>
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
                          ) : (
                            <div className="px-5 py-8 text-center bg-gray-50/30">
                              <p className="text-sm text-gray-500">No vehicle trips recorded on this day</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <EmailReportModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        reportName="Daily Trip Report"
        dateRange={`${dateRangeLabel}${selectedVehicleId !== 'all' ? ` · ${selectedVehicleLabel}` : ''}`}
        csvContent={buildEmailCsv()}
      />
    </div>
  );
}
