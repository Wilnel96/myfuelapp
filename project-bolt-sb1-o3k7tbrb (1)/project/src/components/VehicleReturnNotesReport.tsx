import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Download, MessageSquare, Truck, User, Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface ReturnNoteRow {
  return_id: string;
  returned_at: string;
  draw_id: string;
  drawn_at: string;
  registration_number: string;
  make: string;
  model: string;
  driver_name: string;
  notes: string;
  odometer_draw: number;
  odometer_return: number;
  km_travelled: number;
  trip_description: string | null;
}

export default function VehicleReturnNotesReport() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<ReturnNoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState('');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filterDriver, setFilterDriver] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');

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
    setExpandedRow(null);

    try {
      const start = `${startDate}T00:00:00.000Z`;
      const end   = `${endDate}T23:59:59.999Z`;

      // Fetch return transactions with notes in the date range
      const { data: returns, error: retErr } = await supabase
        .from('vehicle_transactions')
        .select(`
          id,
          created_at,
          odometer_reading,
          notes,
          related_transaction_id,
          vehicle_id,
          driver_id,
          vehicles (registration_number, make, model),
          drivers (first_name, surname)
        `)
        .eq('organization_id', orgId)
        .eq('transaction_type', 'return')
        .not('notes', 'is', null)
        .neq('notes', '')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (retErr) throw retErr;

      if (!returns || returns.length === 0) {
        setRows([]);
        setGenerated(true);
        return;
      }

      // For each return, fetch the linked draw to get draw time and draw odometer
      const result: ReturnNoteRow[] = [];

      for (const ret of returns) {
        const v = ret.vehicles as any;
        const d = ret.drivers as any;

        let drawnAt = ret.created_at;
        let odoDrawn = ret.odometer_reading;
        let tripDesc: string | null = null;

        if (ret.related_transaction_id) {
          const { data: draw } = await supabase
            .from('vehicle_transactions')
            .select('created_at, odometer_reading, trip_description')
            .eq('id', ret.related_transaction_id)
            .maybeSingle();

          if (draw) {
            drawnAt = draw.created_at;
            odoDrawn = draw.odometer_reading;
            tripDesc = draw.trip_description ?? null;
          }
        }

        const kmTravelled = Math.max(0, ret.odometer_reading - odoDrawn);

        result.push({
          return_id: ret.id,
          returned_at: ret.created_at,
          draw_id: ret.related_transaction_id ?? ret.id,
          drawn_at: drawnAt,
          registration_number: v?.registration_number ?? '-',
          make: v?.make ?? '',
          model: v?.model ?? '',
          driver_name: d ? `${d.first_name} ${d.surname}` : '-',
          notes: ret.notes,
          odometer_draw: odoDrawn,
          odometer_return: ret.odometer_reading,
          km_travelled: kmTravelled,
          trip_description: tripDesc,
        });
      }

      setRows(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setGenerated(true);
    }
  };

  const filteredRows = rows.filter(r => {
    const matchDriver = !filterDriver || r.driver_name.toLowerCase().includes(filterDriver.toLowerCase());
    const matchVehicle = !filterVehicle || r.registration_number.toLowerCase().includes(filterVehicle.toLowerCase());
    return matchDriver && matchVehicle;
  });

  const exportCSV = () => {
    if (!filteredRows.length) return;
    let csv = 'Vehicle,Make/Model,Driver,Drawn At,Returned At,KM Travelled,Trip Description,Return Notes\n';
    filteredRows.forEach((r) => {
      const drawnAt = new Date(r.drawn_at).toLocaleString('en-ZA');
      const returnedAt = new Date(r.returned_at).toLocaleString('en-ZA');
      const safe = (s: string | null) => `"${(s ?? '').replace(/"/g, '""')}"`;
      csv += `${safe(r.registration_number)},${safe(`${r.make} ${r.model}`)},${safe(r.driver_name)},${safe(drawnAt)},${safe(returnedAt)},${r.km_travelled},${safe(r.trip_description)},${safe(r.notes)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehicle-return-notes-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-5">
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
          <button
            onClick={generate}
            disabled={loading || !orgId}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors text-sm"
          >
            <MessageSquare className="w-4 h-4" />
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
          <button
            onClick={exportCSV}
            disabled={!generated || filteredRows.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">{error}</div>
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
            <MessageSquare className={`w-8 h-8 flex-shrink-0 ${rows.length > 0 ? 'text-blue-500' : 'text-gray-400'}`} />
            <div>
              <p className={`font-semibold text-lg ${rows.length > 0 ? 'text-blue-900' : 'text-gray-700'}`}>
                {rows.length > 0
                  ? `${rows.length} return note${rows.length > 1 ? 's' : ''} found`
                  : 'No return notes found for this period'}
              </p>
              <p className={`text-sm mt-0.5 ${rows.length > 0 ? 'text-blue-700' : 'text-gray-500'}`}>
                {rows.length > 0
                  ? `${formatDate(startDate)} – ${formatDate(endDate)}`
                  : 'No drivers left notes during this period.'}
              </p>
            </div>
          </div>

          {rows.length > 0 && (
            <>
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  placeholder="Filter by driver..."
                  value={filterDriver}
                  onChange={(e) => setFilterDriver(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48"
                />
                <input
                  type="text"
                  placeholder="Filter by vehicle..."
                  value={filterVehicle}
                  onChange={(e) => setFilterVehicle(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48"
                />
                {(filterDriver || filterVehicle) && (
                  <button
                    onClick={() => { setFilterDriver(''); setFilterVehicle(''); }}
                    className="text-sm text-gray-500 hover:text-gray-700 px-2"
                  >
                    Clear filters
                  </button>
                )}
                {(filterDriver || filterVehicle) && (
                  <span className="text-sm text-gray-500 self-center">
                    Showing {filteredRows.length} of {rows.length}
                  </span>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {filteredRows.map((row) => {
                  const isExpanded = expandedRow === row.return_id;
                  return (
                    <div
                      key={row.return_id}
                      className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Header row */}
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : row.return_id)}
                        className="w-full text-left bg-white px-5 py-4 flex items-center gap-4"
                      >
                        {/* Vehicle */}
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <Truck className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{row.registration_number}</p>
                            <p className="text-xs text-gray-500">{row.make} {row.model}</p>
                          </div>
                        </div>

                        {/* Driver */}
                        <div className="flex items-center gap-2 min-w-[130px]">
                          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{row.driver_name}</span>
                        </div>

                        {/* Date / time */}
                        <div className="flex items-center gap-1.5 min-w-[110px]">
                          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-gray-700">{formatDate(row.returned_at)}</p>
                            <p className="text-xs text-gray-500">{formatTime(row.returned_at)}</p>
                          </div>
                        </div>

                        {/* KM */}
                        <div className="text-sm text-gray-600 min-w-[80px]">
                          <span className="font-medium text-gray-900">{row.km_travelled.toLocaleString()}</span>
                          <span className="text-gray-500"> km</span>
                        </div>

                        {/* Note preview */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate italic">
                            "{row.notes}"
                          </p>
                        </div>

                        {/* Expand toggle */}
                        <div className="flex-shrink-0">
                          {isExpanded
                            ? <ChevronUp className="w-5 h-5 text-gray-400" />
                            : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="bg-gray-50 border-t border-gray-200 px-5 py-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Trip info */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trip Details</h4>
                              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Drawn</span>
                                  <span className="text-gray-900 font-medium">
                                    {formatDate(row.drawn_at)} {formatTime(row.drawn_at)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Returned</span>
                                  <span className="text-gray-900 font-medium">
                                    {formatDate(row.returned_at)} {formatTime(row.returned_at)}
                                  </span>
                                </div>
                                <div className="flex justify-between border-t border-gray-100 pt-2">
                                  <span className="text-gray-500">Odometer (draw)</span>
                                  <span className="text-gray-900">{row.odometer_draw.toLocaleString()} km</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Odometer (return)</span>
                                  <span className="text-gray-900">{row.odometer_return.toLocaleString()} km</span>
                                </div>
                                <div className="flex justify-between border-t border-gray-100 pt-2">
                                  <span className="text-gray-500">Distance travelled</span>
                                  <span className="font-semibold text-blue-700">{row.km_travelled.toLocaleString()} km</span>
                                </div>
                              </div>

                              {row.trip_description && (
                                <div>
                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Trip Description</h4>
                                  <div className="bg-white rounded-lg border border-gray-200 p-3 text-sm text-gray-700 italic">
                                    "{row.trip_description}"
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Return notes */}
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                                Driver Return Notes
                              </h4>
                              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                                {row.notes}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {!generated && !loading && (
        <div className="text-center py-12 text-gray-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Select a date range and click Generate Report to view driver return notes.</p>
        </div>
      )}
    </div>
  );
}
