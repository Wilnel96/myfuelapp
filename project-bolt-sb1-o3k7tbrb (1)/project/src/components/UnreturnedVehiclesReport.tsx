import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Download, AlertTriangle, Clock, User, Truck } from 'lucide-react';

interface UnreturnedRow {
  draw_id: string;
  drawn_at: string;
  vehicle_id: string;
  registration_number: string;
  make: string;
  model: string;
  driver_name: string;
  driver_id: string;
  odometer_reading: number;
  trip_description: string | null;
  hours_out: number;
}

export default function UnreturnedVehiclesReport() {
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<UnreturnedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState('');
  const [orgId, setOrgId] = useState<string | null>(null);

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

  const generate = async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    setRows([]);
    setGenerated(false);

    try {
      // All draw transactions created ON OR BEFORE the chosen date (end of that day)
      // This catches vehicles drawn on earlier days that still haven't been returned.
      const cutoff = `${reportDate}T23:59:59.999Z`;

      const { data: draws, error: drawErr } = await supabase
        .from('vehicle_transactions')
        .select(`
          id,
          created_at,
          odometer_reading,
          trip_description,
          related_transaction_id,
          vehicle_id,
          driver_id,
          vehicles (registration_number, make, model),
          drivers (first_name, surname)
        `)
        .eq('organization_id', orgId)
        .eq('transaction_type', 'draw')
        .lte('created_at', cutoff)
        .order('created_at', { ascending: true });

      if (drawErr) throw drawErr;

      if (!draws || draws.length === 0) {
        setRows([]);
        setGenerated(true);
        return;
      }

      // Filter: no return transaction linked to this draw exists on or before the chosen date
      const unreturned: UnreturnedRow[] = [];
      const reportEndMs = new Date(cutoff).getTime();

      for (const draw of draws) {
        const { data: ret } = await supabase
          .from('vehicle_transactions')
          .select('id')
          .eq('related_transaction_id', draw.id)
          .eq('transaction_type', 'return')
          .lte('created_at', cutoff)
          .maybeSingle();

        if (!ret) {
          const drawnAt = new Date(draw.created_at);
          const hoursOut = Math.floor((reportEndMs - drawnAt.getTime()) / (1000 * 60 * 60));

          const v = draw.vehicles as any;
          const d = draw.drivers as any;

          unreturned.push({
            draw_id: draw.id,
            drawn_at: draw.created_at,
            vehicle_id: draw.vehicle_id,
            registration_number: v?.registration_number ?? '-',
            make: v?.make ?? '',
            model: v?.model ?? '',
            driver_name: d ? `${d.first_name} ${d.surname}` : '-',
            driver_id: draw.driver_id,
            odometer_reading: draw.odometer_reading,
            trip_description: draw.trip_description ?? null,
            hours_out: hoursOut,
          });
        }
      }

      unreturned.sort((a, b) => b.hours_out - a.hours_out);
      setRows(unreturned);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setGenerated(true);
    }
  };

  const exportCSV = () => {
    if (!rows.length) return;
    let csv = 'Vehicle,Make/Model,Driver,Drawn At,Hours Out,Odometer,Trip Description\n';
    rows.forEach((r) => {
      const drawnAt = new Date(r.drawn_at).toLocaleString();
      csv += `"${r.registration_number}","${r.make} ${r.model}","${r.driver_name}","${drawnAt}",${r.hours_out},${r.odometer_reading},"${r.trip_description ?? ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unreturned-vehicles-${reportDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">Date:</label>
            <input
              type="date"
              value={reportDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => { setReportDate(e.target.value); setGenerated(false); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={generate}
            disabled={loading || !orgId}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors text-sm"
          >
            <AlertTriangle className="w-4 h-4" />
            {loading ? 'Checking...' : 'Generate Report'}
          </button>
          <button
            onClick={exportCSV}
            disabled={!generated || rows.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">{error}</div>
      )}

      {/* Results */}
      {generated && !loading && (
        <>
          {/* Summary card */}
          <div className={`rounded-lg p-4 flex items-center gap-4 ${rows.length > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
            {rows.length > 0 ? (
              <AlertTriangle className="w-8 h-8 text-orange-500 flex-shrink-0" />
            ) : (
              <Truck className="w-8 h-8 text-green-500 flex-shrink-0" />
            )}
            <div>
              <p className={`font-semibold text-lg ${rows.length > 0 ? 'text-orange-900' : 'text-green-900'}`}>
                {rows.length > 0
                  ? `${rows.length} vehicle${rows.length > 1 ? 's' : ''} still out as of ${new Date(reportDate + 'T12:00:00').toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}`
                  : `All vehicles were returned by end of ${new Date(reportDate + 'T12:00:00').toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}`}
              </p>
              {rows.length > 0 && (
                <p className="text-orange-700 text-sm mt-0.5">
                  Showing all draws with no return recorded on or before this date, regardless of when they were drawn.
                </p>
              )}
            </div>
          </div>

          {rows.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Vehicle</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Driver</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Drawn At</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Hours Out</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Odometer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Trip Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row) => (
                      <tr key={row.draw_id} className="hover:bg-orange-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div>
                              <p className="font-semibold text-gray-900">{row.registration_number}</p>
                              <p className="text-xs text-gray-500">{row.make} {row.model}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-800">{row.driver_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {new Date(row.drawn_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 font-semibold ${row.hours_out >= 24 ? 'text-red-600' : row.hours_out >= 12 ? 'text-orange-600' : 'text-gray-700'}`}>
                            <Clock className="w-3.5 h-3.5" />
                            {row.hours_out}h
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {row.odometer_reading.toLocaleString()} km
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs">
                          {row.trip_description
                            ? <span className="text-gray-700">{row.trip_description}</span>
                            : <span className="text-gray-400 italic">Not specified</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Colour legend */}
              <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 flex items-center gap-6 text-xs text-gray-600">
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-gray-400"></span> Under 12 hours</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-orange-500"></span> 12 – 23 hours</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-red-500"></span> 24+ hours</span>
              </div>
            </div>
          )}
        </>
      )}

      {!generated && !loading && (
        <div className="text-center py-12 text-gray-400">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Select a date and click Generate Report to view unreturned vehicles.</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
}
