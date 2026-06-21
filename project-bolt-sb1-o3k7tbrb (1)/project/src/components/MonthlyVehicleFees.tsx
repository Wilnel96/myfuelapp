import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  DollarSign, Save, AlertCircle, CheckCircle, ArrowLeft,
  RefreshCw, Info, Car, Users, ChevronDown, ChevronUp,
} from 'lucide-react';

interface StandardMonthlyFeesProps {
  onBack: () => void;
}

interface OrgRow {
  id: string;
  name: string;
  monthly_fee_per_vehicle: number | null;
  monthly_fee_per_driver: number | null;
  vehicle_count: number;
  driver_count: number;
}

function toggleSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
}

interface ClientDropdownProps {
  type: 'vehicle' | 'driver';
  orgs: OrgRow[];
  loading: boolean;
  globalRate: number;
  excluded: Set<string>;
  setExcluded: (s: Set<string>) => void;
}

function ClientDropdown({ type, orgs, loading, globalRate, excluded, setExcluded }: ClientDropdownProps) {
  const isVehicle = type === 'vehicle';
  const countKey = isVehicle ? 'vehicle_count' as const : 'driver_count' as const;
  const rateKey = isVehicle ? 'monthly_fee_per_vehicle' as const : 'monthly_fee_per_driver' as const;
  const checkColor = isVehicle ? 'text-teal-600 focus:ring-teal-500' : 'text-blue-600 focus:ring-blue-500';
  const allExcluded = orgs.length > 0 && excluded.size === orgs.length;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 grid grid-cols-[1.75rem_1fr_3.5rem_5.5rem] gap-2 items-center">
        <label className="flex items-center justify-center cursor-pointer" title="Exclude all">
          <input
            type="checkbox"
            checked={allExcluded}
            onChange={(e) => setExcluded(new Set(e.target.checked ? orgs.map((o) => o.id) : []))}
            className={`w-3.5 h-3.5 ${checkColor} border-gray-300 rounded`}
          />
        </label>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</span>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
          {isVehicle ? 'Veh.' : 'Drv.'}
        </span>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Current Rate</span>
      </div>

      {loading ? (
        <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
      ) : orgs.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">No clients found</div>
      ) : (
        <>
          <div className="divide-y divide-gray-100 overflow-y-auto" style={{ maxHeight: '20rem' }}>
            {orgs.map((org) => {
              const isExcluded = excluded.has(org.id);
              const rate = org[rateKey];
              const differs = rate != null && Math.abs(rate - globalRate) > 0.001;
              return (
                <div
                  key={org.id}
                  onClick={() => setExcluded(toggleSet(excluded, org.id))}
                  className={`grid grid-cols-[1.75rem_1fr_3.5rem_5.5rem] gap-2 px-5 py-2.5 items-center cursor-pointer transition-colors ${isExcluded ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isExcluded}
                      onChange={() => setExcluded(toggleSet(excluded, org.id))}
                      className={`w-3.5 h-3.5 ${checkColor} border-gray-300 rounded`}
                    />
                  </div>
                  <span className={`text-xs font-medium truncate ${isExcluded ? 'text-amber-700' : 'text-gray-900'}`} title={org.name}>
                    {org.name}
                  </span>
                  <span className="text-xs text-gray-500 text-center">{org[countKey]}</span>
                  <div className="text-right">
                    {rate != null
                      ? <span className={`text-xs font-medium ${differs ? 'text-amber-600' : 'text-gray-700'}`}>R{Number(rate).toFixed(2)}</span>
                      : <span className="text-xs text-gray-400 italic">—</span>
                    }
                    {differs && <span className="ml-1 text-xs text-amber-400">(c)</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {excluded.size > 0 && (
            <div className="px-5 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-1.5 text-xs text-amber-700">
              <Info className="w-3 h-3 flex-shrink-0" />
              {excluded.size} client(s) will keep their current rate.
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MonthlyVehicleFees({ onBack }: StandardMonthlyFeesProps) {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Which panel is open: null | 'vehicle' | 'driver'
  const [openPanel, setOpenPanel] = useState<'vehicle' | 'driver' | null>(null);

  const [globalV, setGlobalV] = useState('');
  const [newV, setNewV] = useState('');
  const [excludedV, setExcludedV] = useState<Set<string>>(new Set());
  const [savingV, setSavingV] = useState(false);
  const [successV, setSuccessV] = useState('');
  const [errorV, setErrorV] = useState('');

  const [globalD, setGlobalD] = useState('');
  const [newD, setNewD] = useState('');
  const [excludedD, setExcludedD] = useState<Set<string>>(new Set());
  const [savingD, setSavingD] = useState(false);
  const [successD, setSuccessD] = useState('');
  const [errorD, setErrorD] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [vRes, dRes, orgsRes] = await Promise.all([
        supabase.from('global_settings').select('value').eq('key', 'monthly_fee_per_vehicle').maybeSingle(),
        supabase.from('global_settings').select('value').eq('key', 'monthly_fee_per_driver').maybeSingle(),
        supabase
          .from('organizations')
          .select('id, name, monthly_fee_per_vehicle, monthly_fee_per_driver')
          .eq('organization_type', 'client')
          .eq('is_management_org', false)
          .order('name'),
      ]);
      if (vRes.error) throw vRes.error;
      if (dRes.error) throw dRes.error;
      if (orgsRes.error) throw orgsRes.error;

      const vFee = vRes.data?.value ?? '10';
      const dFee = dRes.data?.value ?? '0';
      setGlobalV(vFee); setNewV(vFee);
      setGlobalD(dFee); setNewD(dFee);

      const orgIds = (orgsRes.data ?? []).map((o) => o.id);
      const vc: Record<string, number> = {};
      const dc: Record<string, number> = {};
      if (orgIds.length > 0) {
        const [vcRes, dcRes] = await Promise.all([
          supabase.from('vehicles').select('organization_id').in('organization_id', orgIds).eq('status', 'active'),
          supabase.from('drivers').select('organization_id').in('organization_id', orgIds).eq('status', 'active'),
        ]);
        (vcRes.data ?? []).forEach((v) => { vc[v.organization_id] = (vc[v.organization_id] ?? 0) + 1; });
        (dcRes.data ?? []).forEach((d) => { dc[d.organization_id] = (dc[d.organization_id] ?? 0) + 1; });
      }
      setOrgs((orgsRes.data ?? []).map((o) => ({
        id: o.id,
        name: o.name,
        monthly_fee_per_vehicle: o.monthly_fee_per_vehicle,
        monthly_fee_per_driver: o.monthly_fee_per_driver,
        vehicle_count: vc[o.id] ?? 0,
        driver_count: dc[o.id] ?? 0,
      })));
    } catch (err: any) {
      setLoadError(err.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveV = async () => {
    const parsed = parseFloat(newV);
    if (isNaN(parsed) || parsed < 0) { setErrorV('Enter a valid amount'); return; }
    setSavingV(true); setErrorV(''); setSuccessV('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error: sErr } = await supabase.from('global_settings')
        .update({ value: parsed.toString(), updated_at: new Date().toISOString(), updated_by: user.id })
        .eq('key', 'monthly_fee_per_vehicle');
      if (sErr) throw sErr;
      setGlobalV(parsed.toString());
      const toUpdate = orgs.filter((o) => !excludedV.has(o.id));
      if (toUpdate.length > 0) {
        const { error: uErr } = await supabase.from('organizations')
          .update({ monthly_fee_per_vehicle: parsed })
          .in('id', toUpdate.map((o) => o.id));
        if (uErr) throw uErr;
        setOrgs((prev) => prev.map((o) => excludedV.has(o.id) ? o : { ...o, monthly_fee_per_vehicle: parsed }));
      }
      setSuccessV(`Updated for ${toUpdate.length} client(s).${excludedV.size > 0 ? ` ${excludedV.size} excluded.` : ''}`);
    } catch (err: any) {
      setErrorV(err.message ?? 'Failed to save');
    } finally {
      setSavingV(false);
    }
  };

  const handleSaveD = async () => {
    const parsed = parseFloat(newD);
    if (isNaN(parsed) || parsed < 0) { setErrorD('Enter a valid amount'); return; }
    setSavingD(true); setErrorD(''); setSuccessD('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error: sErr } = await supabase.from('global_settings')
        .update({ value: parsed.toString(), updated_at: new Date().toISOString(), updated_by: user.id })
        .eq('key', 'monthly_fee_per_driver');
      if (sErr) throw sErr;
      setGlobalD(parsed.toString());
      const toUpdate = orgs.filter((o) => !excludedD.has(o.id));
      if (toUpdate.length > 0) {
        const { error: uErr } = await supabase.from('organizations')
          .update({ monthly_fee_per_driver: parsed })
          .in('id', toUpdate.map((o) => o.id));
        if (uErr) throw uErr;
        setOrgs((prev) => prev.map((o) => excludedD.has(o.id) ? o : { ...o, monthly_fee_per_driver: parsed }));
      }
      setSuccessD(`Updated for ${toUpdate.length} client(s).${excludedD.size > 0 ? ` ${excludedD.size} excluded.` : ''}`);
    } catch (err: any) {
      setErrorD(err.message ?? 'Failed to save');
    } finally {
      setSavingD(false);
    }
  };

  const parsedNewV = parseFloat(newV);
  const parsedGlobalV = parseFloat(globalV || '0');
  const parsedNewD = parseFloat(newD);
  const parsedGlobalD = parseFloat(globalD || '0');

  const vChanged = newV !== globalV;
  const dChanged = newD !== globalD;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Standard Monthly Fees</h2>
            <p className="text-sm text-gray-500">Manage the global rates charged per active vehicle and driver each month</p>
          </div>
        </div>
        <button onClick={load} className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{loadError}</p>
        </div>
      )}

      {/* Fee row — both fees side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Vehicle Fee card */}
        <div className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${openPanel === 'vehicle' ? 'border-teal-400 ring-1 ring-teal-300' : 'border-gray-200'}`}>
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Car className="w-4 h-4 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Vehicle Fee</p>
                <p className="text-xs text-gray-500">Current global: <span className="font-medium text-gray-700">R{parsedGlobalV.toFixed(2)}</span>/vehicle/month</p>
              </div>
            </div>

            {errorV && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                <p className="text-red-800 text-xs">{errorV}</p>
              </div>
            )}
            {successV && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                <p className="text-green-800 text-xs">{successV}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium pointer-events-none">R</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newV}
                  onChange={(e) => { setNewV(e.target.value); setSuccessV(''); }}
                  onFocus={(e) => e.target.select()}
                  className="w-full pl-7 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              {vChanged && !isNaN(parsedNewV) && (
                <span className={`text-xs font-medium px-2 py-1 rounded ${parsedNewV > parsedGlobalV ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                  {parsedNewV > parsedGlobalV ? '+' : '-'}R{Math.abs(parsedNewV - parsedGlobalV).toFixed(2)}
                </span>
              )}
              <button
                onClick={handleSaveV}
                disabled={savingV || !vChanged || isNaN(parsedNewV) || parsedNewV < 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-auto"
              >
                {savingV ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>

            {/* Toggle clients */}
            <button
              onClick={() => setOpenPanel(openPanel === 'vehicle' ? null : 'vehicle')}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
            >
              <span>Client Exclusions {excludedV.size > 0 && <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{excludedV.size} excluded</span>}</span>
              {openPanel === 'vehicle' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
        </div>

        {/* Driver Fee card */}
        <div className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${openPanel === 'driver' ? 'border-blue-400 ring-1 ring-blue-300' : 'border-gray-200'}`}>
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Driver Fee</p>
                <p className="text-xs text-gray-500">Current global: <span className="font-medium text-gray-700">R{parsedGlobalD.toFixed(2)}</span>/driver/month</p>
              </div>
            </div>

            {errorD && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                <p className="text-red-800 text-xs">{errorD}</p>
              </div>
            )}
            {successD && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                <p className="text-green-800 text-xs">{successD}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium pointer-events-none">R</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newD}
                  onChange={(e) => { setNewD(e.target.value); setSuccessD(''); }}
                  onFocus={(e) => e.target.select()}
                  className="w-full pl-7 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {dChanged && !isNaN(parsedNewD) && (
                <span className={`text-xs font-medium px-2 py-1 rounded ${parsedNewD > parsedGlobalD ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                  {parsedNewD > parsedGlobalD ? '+' : '-'}R{Math.abs(parsedNewD - parsedGlobalD).toFixed(2)}
                </span>
              )}
              <button
                onClick={handleSaveD}
                disabled={savingD || !dChanged || isNaN(parsedNewD) || parsedNewD < 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-auto"
              >
                {savingD ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>

            {/* Toggle clients */}
            <button
              onClick={() => setOpenPanel(openPanel === 'driver' ? null : 'driver')}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
            >
              <span>Client Exclusions {excludedD.size > 0 && <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{excludedD.size} excluded</span>}</span>
              {openPanel === 'driver' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
        </div>
      </div>

      {/* Client exclusion dropdown — only one open at a time */}
      {openPanel === 'vehicle' && (
        <ClientDropdown
          type="vehicle"
          orgs={orgs}
          loading={loading}
          globalRate={parsedGlobalV}
          excluded={excludedV}
          setExcluded={setExcludedV}
        />
      )}
      {openPanel === 'driver' && (
        <ClientDropdown
          type="driver"
          orgs={orgs}
          loading={loading}
          globalRate={parsedGlobalD}
          excluded={excludedD}
          setExcluded={setExcludedD}
        />
      )}
    </div>
  );
}
