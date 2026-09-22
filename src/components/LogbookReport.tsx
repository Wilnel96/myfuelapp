import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Download, BookOpen, Truck, User, AlertCircle, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';

interface LogbookRow {
  id: string;
  entry_date: string;
  vehicle_registration: string;
  vehicle_make: string;
  vehicle_model: string;
  driver_name: string;
  opening_km: number;
  trip_reason: string;
  closing_km: number | null;
  km_travelled: number | null;
  sequence_number: number;
}

interface VehicleOption {
  id: string;
  registration_number: string;
  make: string;
  model: string;
}

interface DriverOption {
  id: string;
  first_name: string;
  surname: string;
}

export default function LogbookReport() {
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState(monthAgo);
  const [endDate, setEndDate] = useState(today);
  const [rows, setRows] = useState<LogbookRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('all');
  const [selectedDriverId, setSelectedDriverId] = useState('all');
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.organization_id) setOrgId(profile.organization_id);
    })();
  }, []);

  useEffect(() => {
    if (orgId) {
      loadVehiclesAndDrivers();
    }
  }, [orgId]);

  const loadVehiclesAndDrivers = async () => {
    if (!orgId) return;
    const [{ data: vData }, { data: dData }] = await Promise.all([
      supabase
        .from('vehicles')
        .select('id, registration_number, make, model')
        .eq('organization_id', orgId)
        .order('registration_number', { ascending: true }),
      supabase
        .from('drivers')
        .select('id, first_name, surname')
        .eq('organization_id', orgId)
        .order('first_name', { ascending: true }),
    ]);
    setVehicles(vData || []);
    setDrivers(dData || []);
  };

  const generate = async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    setRows([]);
    setGenerated(false);
    setExpandedVehicle(null);

    try {
      let query = supabase
        .from('trip_logbook_entries')
        .select(`
          id,
          entry_date,
          opening_km,
          trip_reason,
          closing_km,
          km_travelled,
          sequence_number,
          vehicle_id,
          driver_id,
          vehicles!inner(registration_number, make, model),
          drivers!inner(first_name, surname)
        `)
        .eq('organization_id', orgId)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate)
        .order('entry_date', { ascending: true })
        .order('sequence_number', { ascending: true });

      if (selectedVehicleId !== 'all') {
        query = query.eq('vehicle_id', selectedVehicleId);
      }
      if (selectedDriverId !== 'all') {
        query = query.eq('driver_id', selectedDriverId);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      const mapped: LogbookRow[] = (data || []).map((r: any) => ({
        id: r.id,
        entry_date: r.entry_date,
        vehicle_registration: r.vehicles?.registration_number || '-',
        vehicle_make: r.vehicles?.make || '',
        vehicle_model: r.vehicles?.model || '',
        driver_name: r.drivers ? `${r.drivers.first_name} ${r.drivers.surname}` : '-',
        opening_km: r.opening_km,
        trip_reason: r.trip_reason,
        closing_km: r.closing_km,
        km_travelled: r.km_travelled,
        sequence_number: r.sequence_number,
      }));

      setRows(mapped);
    } catch (err: any) {
      setError(err.message || 'Failed to load logbook data');
    } finally {
      setLoading(false);
      setGenerated(true);
    }
  };

  // Group rows by vehicle
  const vehicleGroups = useMemo(() => {
    const groups = new Map<string, { registration: string; make: string; model: string; rows: LogbookRow[]; totalKm: number }>();
    for (const row of rows) {
      const key = row.vehicle_registration;
      if (!groups.has(key)) {
        groups.set(key, { registration: row.vehicle_registration, make: row.vehicle_make, model: row.vehicle_model, rows: [], totalKm: 0 });
      }
      const g = groups.get(key)!;
      g.rows.push(row);
      g.totalKm += row.km_travelled || 0;
    }
    return Array.from(groups.values()).sort((a, b) => a.registration.localeCompare(b.registration));
  }, [rows]);

  const totalKm = rows.reduce((sum, r) => sum + (r.km_travelled || 0), 0);

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const exportExcel = () => {
    if (!rows.length) return;

    const wb = XLSX.utils.book_new();

    // Build SARS logbook format rows
    const excelRows: any[] = [];
    let prevClosingKm: number | null = null;
    let prevVehicle = '';

    for (const row of rows) {
      if (prevVehicle && prevVehicle !== row.vehicle_registration) {
        // Add a gap row between vehicles
        excelRows.push({});
      }
      excelRows.push({
        'Date': row.entry_date,
        'Vehicle': row.vehicle_registration,
        'Driver': row.driver_name,
        'Open km': row.opening_km,
        'Reason': row.trip_reason,
        'Closing km': row.closing_km ?? '',
        'KM Travelled': row.km_travelled ?? '',
      });
      prevClosingKm = row.closing_km ?? null;
      prevVehicle = row.vehicle_registration;
    }

    // Add total row
    excelRows.push({});
    excelRows.push({
      'Reason': 'TOTAL KM',
      'KM Travelled': totalKm,
    });

    const ws = XLSX.utils.json_to_sheet(excelRows, {
      header: ['Date', 'Vehicle', 'Driver', 'Open km', 'Reason', 'Closing km', 'KM Travelled'],
    });

    ws['!cols'] = [
      { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 14 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'SARS Logbook');
    XLSX.writeFile(wb, `sars-logbook-${startDate}-to-${endDate}.xlsx`);
  };

  const exportCSV = () => {
    if (!rows.length) return;

    let csv = `MyFuelApp.net - SARS Logbook Report\nFrom: ${formatDate(startDate)}  To: ${formatDate(endDate)}\nGenerated: ${new Date().toLocaleString('en-GB')}\n\n`;
    csv += 'Date,Vehicle,Driver,Open km,Reason,Closing km,KM Travelled\n';

    const safe = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;

    let prevVehicle = '';
    for (const row of rows) {
      if (prevVehicle && prevVehicle !== row.vehicle_registration) {
        csv += '\n';
      }
      csv += `${row.entry_date},${safe(row.vehicle_registration)},${safe(row.driver_name)},${row.opening_km},${safe(row.trip_reason)},${row.closing_km ?? ''},${row.km_travelled ?? ''}\n`;
      prevVehicle = row.vehicle_registration;
    }
    csv += `\n,,,,"TOTAL KM",,${totalKm}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sars-logbook-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Heading */}
      <div className="border-b border-gray-200 pb-3">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          MyFuelApp.net — SARS Logbook Report
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          From: {formatDate(startDate)} &nbsp; To: {formatDate(endDate)}
        </p>
      </div>

      {/* Controls */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setGenerated(false); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setGenerated(false); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Vehicle filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedVehicleId}
              onChange={(e) => { setSelectedVehicleId(e.target.value); setGenerated(false); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">All Vehicles</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.registration_number} ({v.make} {v.model})</option>
              ))}
            </select>
          </div>

          {/* Driver filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedDriverId}
              onChange={(e) => { setSelectedDriverId(e.target.value); setGenerated(false); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">All Drivers</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.first_name} {d.surname}</option>
              ))}
            </select>
          </div>

          <button
            onClick={generate}
            disabled={loading || !orgId}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors text-sm"
          >
            <BookOpen className="w-4 h-4" />
            {loading ? 'Loading...' : 'Generate Report'}
          </button>

          <button
            onClick={exportExcel}
            disabled={!generated || rows.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>

          <button
            onClick={exportCSV}
            disabled={!generated || rows.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-300 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      )}

      {generated && !loading && (
        <>
          {/* Summary */}
          <div className={`rounded-lg p-4 flex items-center gap-4 ${rows.length > 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
            <BookOpen className={`w-8 h-8 flex-shrink-0 ${rows.length > 0 ? 'text-blue-500' : 'text-gray-400'}`} />
            <div>
              <p className={`font-semibold text-lg ${rows.length > 0 ? 'text-blue-900' : 'text-gray-700'}`}>
                {rows.length > 0
                  ? `${rows.length} logbook ${rows.length === 1 ? 'entry' : 'entries'} — ${totalKm.toLocaleString()} km total`
                  : 'No logbook entries found for this period'}
              </p>
              <p className={`text-sm mt-0.5 ${rows.length > 0 ? 'text-blue-700' : 'text-gray-500'}`}>
                {formatDate(startDate)} — {formatDate(endDate)}
              </p>
            </div>
          </div>

          {/* Vehicle grouped results */}
          {vehicleGroups.length > 0 && (
            <div className="space-y-4">
              {vehicleGroups.map((group) => {
                const isExpanded = expandedVehicle === group.registration || (expandedVehicle === null && vehicleGroups.length === 1);
                return (
                  <div key={group.registration} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {/* Header */}
                    <button
                      onClick={() => setExpandedVehicle(isExpanded ? null : group.registration)}
                      className="w-full text-left bg-white px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                    >
                      <Truck className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{group.registration}</p>
                        <p className="text-xs text-gray-500">{group.make} {group.model}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{group.rows.length} {group.rows.length === 1 ? 'entry' : 'entries'}</p>
                        <p className="text-xs text-blue-700 font-medium">{group.totalKm.toLocaleString()} km</p>
                      </div>
                      {isExpanded
                        ? <ChevronUp className="w-5 h-5 text-gray-400" />
                        : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </button>

                    {/* Expanded table */}
                    {isExpanded && (
                      <div className="overflow-x-auto border-t border-gray-200">
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Open km</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Closing km</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">KM Travelled</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {group.rows.map((row) => (
                              <tr key={row.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.entry_date)}</td>
                                <td className="px-4 py-3 text-sm text-gray-700 flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-gray-400" />
                                  {row.driver_name}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">{row.opening_km.toLocaleString()}</td>
                                <td className="px-4 py-3 text-sm text-gray-800">{row.trip_reason}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">{row.closing_km != null ? row.closing_km.toLocaleString() : <span className="text-gray-400 italic">—</span>}</td>
                                <td className="px-4 py-3 text-sm text-blue-700 text-right font-medium">{row.km_travelled != null ? row.km_travelled.toLocaleString() : <span className="text-gray-400 italic">—</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 font-semibold">
                              <td colSpan={5} className="px-4 py-3 text-sm text-gray-900 text-right">Total KM:</td>
                              <td className="px-4 py-3 text-sm text-blue-700 text-right">{group.totalKm.toLocaleString()}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Grand total */}
              <div className="bg-blue-600 text-white rounded-lg p-4 flex items-center justify-between">
                <span className="font-bold text-lg">Grand Total KM Travelled</span>
                <span className="font-bold text-2xl">{totalKm.toLocaleString()} km</span>
              </div>
            </div>
          )}
        </>
      )}

      {!generated && !loading && (
        <div className="text-center py-12 text-gray-400">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Select a date range and click Generate Report to view logbook entries.</p>
        </div>
      )}
    </div>
  );
}
