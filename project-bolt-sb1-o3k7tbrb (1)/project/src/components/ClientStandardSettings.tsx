import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Settings, Save, X, AlertCircle, CheckCircle, ArrowLeft, Info,
  Car, Users, ChevronDown, ChevronUp, RefreshCw, CreditCard,
  Calendar, Clock, Percent,
} from 'lucide-react';

interface ClientStandardSettingsProps {
  onBack: () => void;
}

interface OrgRow {
  id: string;
  name: string;
  monthly_fee_per_vehicle: number | null;
  monthly_fee_per_driver: number | null;
  vehicle_count: number;
  driver_count: number;
  payment_method: string | null;
  payment_terms: string | null;
  payment_date: number | null;
  debit_order_lead_days: number | null;
  late_payment_interest_rate: number | null;
}

// Keys that are purely global_settings (no per-org application)
const BILLING_KEYS = [
  'standard_payment_method',
  'standard_payment_terms',
  'standard_payment_date',
  'standard_debit_order_lead_days',
  'standard_late_payment_interest_rate',
] as const;

type BillingKey = typeof BILLING_KEYS[number];

// Maps global_settings key → organizations column name
const ORG_COLUMN: Record<BillingKey, keyof OrgRow> = {
  standard_payment_method:             'payment_method',
  standard_payment_terms:              'payment_terms',
  standard_payment_date:               'payment_date',
  standard_debit_order_lead_days:      'debit_order_lead_days',
  standard_late_payment_interest_rate: 'late_payment_interest_rate',
};

function toggleSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
}

// ── Generic exclusion panel (reused for all fields) ──────────────────────────

interface ExclusionPanelProps {
  fieldLabel: string;
  newValue: string;
  orgColumn: keyof OrgRow;
  orgs: OrgRow[];
  orgsLoading: boolean;
  excluded: Set<string>;
  setExcluded: (s: Set<string>) => void;
  open: boolean;
  onToggle: () => void;
  formatValue?: (v: string | number | null) => string;
}

function ExclusionPanel({
  fieldLabel, newValue, orgColumn, orgs, orgsLoading,
  excluded, setExcluded, open, onToggle, formatValue,
}: ExclusionPanelProps) {
  const allExcluded = orgs.length > 0 && excluded.size === orgs.length;
  const fmt = formatValue ?? ((v) => v != null ? String(v) : '—');

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-2 rounded-lg border text-xs font-medium transition-colors ${
          open ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
        }`}
      >
        <span className="flex items-center gap-1.5">
          Client Exclusions for {fieldLabel}
          {excluded.size > 0 && (
            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
              {excluded.size} excluded
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="mt-1.5 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 grid grid-cols-[1.75rem_1fr_7rem] gap-2 items-center">
            <label className="flex items-center justify-center cursor-pointer" title="Exclude all">
              <input
                type="checkbox"
                checked={allExcluded}
                onChange={(e) => setExcluded(new Set(e.target.checked ? orgs.map((o) => o.id) : []))}
                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded"
              />
            </label>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Current Value</span>
          </div>

          {orgsLoading ? (
            <div className="p-5 text-center text-gray-400 text-sm">Loading clients...</div>
          ) : orgs.length === 0 ? (
            <div className="p-5 text-center text-gray-400 text-sm">No clients found</div>
          ) : (
            <>
              <div className="divide-y divide-gray-100 overflow-y-auto" style={{ maxHeight: '14rem' }}>
                {orgs.map((org) => {
                  const isExcluded = excluded.has(org.id);
                  const currentVal = org[orgColumn];
                  const currentFmt = fmt(currentVal as any);
                  const differs = newValue !== '' && currentFmt !== newValue && currentVal != null;
                  return (
                    <div
                      key={org.id}
                      onClick={() => setExcluded(toggleSet(excluded, org.id))}
                      className={`grid grid-cols-[1.75rem_1fr_7rem] gap-2 px-4 py-2.5 items-center cursor-pointer transition-colors ${
                        isExcluded ? 'bg-amber-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isExcluded}
                          onChange={() => setExcluded(toggleSet(excluded, org.id))}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded"
                        />
                      </div>
                      <span className={`text-xs font-medium truncate ${isExcluded ? 'text-amber-700' : 'text-gray-900'}`} title={org.name}>
                        {org.name}
                      </span>
                      <div className="text-right">
                        {currentVal != null
                          ? <span className={`text-xs font-medium ${differs ? 'text-amber-600' : 'text-gray-600'}`}>{currentFmt}</span>
                          : <span className="text-xs text-gray-400 italic">not set</span>
                        }
                        {differs && <span className="ml-1 text-xs text-amber-400">(c)</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {excluded.size > 0 && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-1.5 text-xs text-amber-700">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  {excluded.size} client(s) will keep their current value.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClientStandardSettings({ onBack }: ClientStandardSettingsProps) {
  // Financial defaults
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Record<string, string>>({});

  // Fee fields
  const [globalV, setGlobalV] = useState('');
  const [globalD, setGlobalD] = useState('');
  const [newV, setNewV] = useState('');
  const [newD, setNewD] = useState('');

  // Client org data
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);

  // Exclusion sets — one per field
  const [excludedV, setExcludedV]           = useState<Set<string>>(new Set());
  const [excludedD, setExcludedD]           = useState<Set<string>>(new Set());
  const [excludedPM, setExcludedPM]         = useState<Set<string>>(new Set());
  const [excludedPT, setExcludedPT]         = useState<Set<string>>(new Set());
  const [excludedPDate, setExcludedPDate]   = useState<Set<string>>(new Set());
  const [excludedDO, setExcludedDO]         = useState<Set<string>>(new Set());
  const [excludedInt, setExcludedInt]       = useState<Set<string>>(new Set());

  // Which exclusion panel is open (only one at a time)
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setOrgsLoading(true);
    setError('');
    try {
      const allKeys = [
        ...BILLING_KEYS,
        'standard_monthly_fee_per_vehicle',
        'standard_monthly_fee_per_driver',
        'monthly_fee_per_vehicle',
        'monthly_fee_per_driver',
      ];
      const [settingsRes, orgsRes] = await Promise.all([
        supabase.from('global_settings').select('key, value').in('key', allKeys),
        supabase
          .from('organizations')
          .select('id, name, monthly_fee_per_vehicle, monthly_fee_per_driver, payment_method, payment_terms, payment_date, debit_order_lead_days, late_payment_interest_rate')
          .eq('organization_type', 'client')
          .eq('is_management_org', false)
          .order('name'),
      ]);
      if (settingsRes.error) throw settingsRes.error;
      if (orgsRes.error) throw orgsRes.error;

      const map: Record<string, string> = {};
      (settingsRes.data ?? []).forEach((r) => { map[r.key] = r.value; });

      const billingMap: Record<string, string> = {};
      BILLING_KEYS.forEach((k) => { billingMap[k] = map[k] ?? ''; });
      setSettings(billingMap);
      setForm(billingMap);

      const vFee = map['monthly_fee_per_vehicle'] ?? map['standard_monthly_fee_per_vehicle'] ?? '0';
      const dFee = map['monthly_fee_per_driver'] ?? map['standard_monthly_fee_per_driver'] ?? '0';
      setGlobalV(vFee); setNewV(vFee);
      setGlobalD(dFee); setNewD(dFee);

      const orgList = orgsRes.data ?? [];
      const orgIds = orgList.map((o) => o.id);
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
      setOrgs(orgList.map((o) => ({
        id: o.id,
        name: o.name,
        monthly_fee_per_vehicle: o.monthly_fee_per_vehicle,
        monthly_fee_per_driver: o.monthly_fee_per_driver,
        vehicle_count: vc[o.id] ?? 0,
        driver_count: dc[o.id] ?? 0,
        payment_method: o.payment_method,
        payment_terms: o.payment_terms,
        payment_date: o.payment_date,
        debit_order_lead_days: o.debit_order_lead_days,
        late_payment_interest_rate: o.late_payment_interest_rate,
      } as OrgRow)));
    } catch (err: any) {
      setError(err.message ?? 'Failed to load settings');
    } finally {
      setLoading(false);
      setOrgsLoading(false);
    }
  };

  const vChanged  = newV !== globalV;
  const dChanged  = newD !== globalD;
  const billingChanged = BILLING_KEYS.some((k) => (form[k] ?? '') !== (settings[k] ?? ''));
  const hasChanges = vChanged || dChanged || billingChanged;

  const parsedNewV = parseFloat(newV);
  const parsedGlobalV = parseFloat(globalV || '0');
  const parsedNewD = parseFloat(newD);
  const parsedGlobalD = parseFloat(globalD || '0');

  // Helper: apply a billing field change to non-excluded orgs
  const applyToOrgs = async (
    orgColumn: keyof OrgRow,
    value: string | number,
    excluded: Set<string>,
  ) => {
    const toUpdate = orgs.filter((o) => !excluded.has(o.id));
    if (toUpdate.length === 0) return { updated: 0, excluded: excluded.size };
    const { error: uErr } = await supabase
      .from('organizations')
      .update({ [orgColumn]: value })
      .in('id', toUpdate.map((o) => o.id));
    if (uErr) throw uErr;
    setOrgs((prev) =>
      prev.map((o) => excluded.has(o.id) ? o : { ...o, [orgColumn]: value })
    );
    return { updated: toUpdate.length, excluded: excluded.size };
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    setSaved(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const now = new Date().toISOString();

      // 1. Save all billing keys to global_settings
      for (const key of BILLING_KEYS) {
        const value = form[key] ?? '';
        const { error: uErr } = await supabase.from('global_settings')
          .update({ value, updated_at: now, updated_by: user.id })
          .eq('key', key);
        if (uErr) throw uErr;
      }

      // 2. Save fee keys (both families) to global_settings
      // Round to 2dp to avoid floating-point drift (e.g. 3 → 2.9999...)
      if (vChanged) {
        if (isNaN(parsedNewV) || parsedNewV < 0) throw new Error('Enter a valid vehicle fee amount');
        const vStr = Math.round(parsedNewV * 100) / 100 + '';
        await Promise.all([
          supabase.from('global_settings').update({ value: vStr, updated_at: now, updated_by: user.id }).eq('key', 'monthly_fee_per_vehicle'),
          supabase.from('global_settings').update({ value: vStr, updated_at: now, updated_by: user.id }).eq('key', 'standard_monthly_fee_per_vehicle'),
        ]);
      }
      if (dChanged) {
        if (isNaN(parsedNewD) || parsedNewD < 0) throw new Error('Enter a valid driver fee amount');
        const dStr = Math.round(parsedNewD * 100) / 100 + '';
        await Promise.all([
          supabase.from('global_settings').update({ value: dStr, updated_at: now, updated_by: user.id }).eq('key', 'monthly_fee_per_driver'),
          supabase.from('global_settings').update({ value: dStr, updated_at: now, updated_by: user.id }).eq('key', 'standard_monthly_fee_per_driver'),
        ]);
      }

      // 3. Apply fee changes to existing orgs (with exclusions)
      const msgs: string[] = ['Standard settings saved.'];

      if (vChanged && !isNaN(parsedNewV)) {
        const roundedV = Math.round(parsedNewV * 100) / 100;
        const r = await applyToOrgs('monthly_fee_per_vehicle', roundedV, excludedV);
        if (r.updated > 0 || r.excluded > 0)
          msgs.push(`Vehicle fee: ${r.updated} client(s) updated${r.excluded > 0 ? `, ${r.excluded} excluded` : ''}.`);
        setGlobalV(roundedV.toString());
        setNewV(roundedV.toString());
      }
      if (dChanged && !isNaN(parsedNewD)) {
        const roundedD = Math.round(parsedNewD * 100) / 100;
        const r = await applyToOrgs('monthly_fee_per_driver', roundedD, excludedD);
        if (r.updated > 0 || r.excluded > 0)
          msgs.push(`Driver fee: ${r.updated} client(s) updated${r.excluded > 0 ? `, ${r.excluded} excluded` : ''}.`);
        setGlobalD(roundedD.toString());
        setNewD(roundedD.toString());
      }

      // 4. Apply billing field changes to existing orgs (with exclusions)
      const billingFields: Array<{ key: BillingKey; col: keyof OrgRow; excluded: Set<string>; label: string; parse: (v: string) => string | number }> = [
        { key: 'standard_payment_method',             col: 'payment_method',             excluded: excludedPM,    label: 'Payment method',      parse: (v) => v },
        { key: 'standard_payment_terms',              col: 'payment_terms',              excluded: excludedPT,    label: 'Payment terms',       parse: (v) => v },
        { key: 'standard_payment_date',               col: 'payment_date',               excluded: excludedPDate, label: 'Payment date',        parse: (v) => parseInt(v) },
        { key: 'standard_debit_order_lead_days',      col: 'debit_order_lead_days',      excluded: excludedDO,    label: 'Debit order lead',    parse: (v) => parseInt(v) },
        { key: 'standard_late_payment_interest_rate', col: 'late_payment_interest_rate', excluded: excludedInt,   label: 'Interest rate',       parse: (v) => Math.round(parseFloat(v) * 100) / 100 },
      ];

      for (const f of billingFields) {
        const newVal = form[f.key] ?? '';
        const oldVal = settings[f.key] ?? '';
        if (newVal === oldVal || newVal === '') continue;
        const parsed = f.parse(newVal);
        if (typeof parsed === 'number' && isNaN(parsed)) continue;
        const r = await applyToOrgs(f.col, parsed, f.excluded);
        if (r.updated > 0 || r.excluded > 0)
          msgs.push(`${f.label}: ${r.updated} client(s) updated${r.excluded > 0 ? `, ${r.excluded} excluded` : ''}.`);
      }

      setSettings({ ...form });
      setSuccess(msgs.join(' '));
      setSaved(true);
      // Reset all exclusion sets
      setExcludedV(new Set()); setExcludedD(new Set());
      setExcludedPM(new Set()); setExcludedPT(new Set());
      setExcludedPDate(new Set()); setExcludedDO(new Set()); setExcludedInt(new Set());
      setOpenPanel(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setForm({ ...settings });
    setNewV(globalV); setNewD(globalD);
    setExcludedV(new Set()); setExcludedD(new Set());
    setExcludedPM(new Set()); setExcludedPT(new Set());
    setExcludedPDate(new Set()); setExcludedDO(new Set()); setExcludedInt(new Set());
    setOpenPanel(null);
    setSaved(false); setError(''); setSuccess('');
  };

  const toggle = (id: string) => setOpenPanel((p) => (p === id ? null : id));
  const setField = (key: string, value: string) => { setForm((f) => ({ ...f, [key]: value })); setSaved(false); };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading settings...</div>;

  return (
    <div className="-my-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white -mx-4 px-4 py-5 pb-4 border-b border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Client Standard Financial Settings</h2>
              <p className="text-gray-500 text-sm">System-wide defaults for new clients — changes can be applied to existing clients with optional exclusions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && !saved && (
              <button onClick={handleDiscard} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                <X className="w-4 h-4" />Discard
              </button>
            )}
            {saved ? (
              <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                <ArrowLeft className="w-4 h-4" />Close
              </button>
            ) : (
              <>
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm">
                  <ArrowLeft className="w-4 h-4" />Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6 max-w-2xl">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-red-800 text-sm">{error}</div>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-green-800 text-sm">{success}</div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-blue-800 text-sm">
            Changes are applied to all existing clients when saved. Expand <strong>Client Exclusions</strong> on any field to tick clients that should keep their current value.
          </p>
        </div>

        {/* ── Monthly Fees ─────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Monthly Fees</h3>
          </div>

          {/* Vehicle fee */}
          <div className="p-5 space-y-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Car className="w-4 h-4 text-teal-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">Monthly Fee per Vehicle (R)</p>
                <p className="text-xs text-gray-500">Current standard: <span className="font-medium text-gray-700">R{parseFloat(globalV || '0').toFixed(2)}/vehicle/month</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium pointer-events-none">R</span>
                <input type="text" inputMode="decimal" value={newV}
                  onChange={(e) => { setNewV(e.target.value); setSaved(false); }}
                  onFocus={(e) => e.target.select()}
                  className="pl-7 pr-3 py-2 w-36 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              {vChanged && !isNaN(parsedNewV) && (
                <span className={`text-xs font-medium px-2 py-1 rounded ${parsedNewV > parsedGlobalV ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                  {parsedNewV > parsedGlobalV ? '+' : ''}R{(parsedNewV - parsedGlobalV).toFixed(2)}
                </span>
              )}
            </div>
            <ExclusionPanel
              fieldLabel="Vehicle Fee"
              newValue={newV}
              orgColumn="monthly_fee_per_vehicle"
              orgs={orgs}
              orgsLoading={orgsLoading}
              excluded={excludedV}
              setExcluded={(s) => { setExcludedV(s); setSaved(false); }}
              open={openPanel === 'vehicle'}
              onToggle={() => toggle('vehicle')}
              formatValue={(v) => v != null ? `R${Number(v).toFixed(2)}` : '—'}
            />
          </div>

          {/* Driver fee */}
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">Monthly Fee per Driver (R)</p>
                <p className="text-xs text-gray-500">Current standard: <span className="font-medium text-gray-700">R{parseFloat(globalD || '0').toFixed(2)}/driver/month</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium pointer-events-none">R</span>
                <input type="text" inputMode="decimal" value={newD}
                  onChange={(e) => { setNewD(e.target.value); setSaved(false); }}
                  onFocus={(e) => e.target.select()}
                  className="pl-7 pr-3 py-2 w-36 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {dChanged && !isNaN(parsedNewD) && (
                <span className={`text-xs font-medium px-2 py-1 rounded ${parsedNewD > parsedGlobalD ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                  {parsedNewD > parsedGlobalD ? '+' : ''}R{(parsedNewD - parsedGlobalD).toFixed(2)}
                </span>
              )}
            </div>
            <ExclusionPanel
              fieldLabel="Driver Fee"
              newValue={newD}
              orgColumn="monthly_fee_per_driver"
              orgs={orgs}
              orgsLoading={orgsLoading}
              excluded={excludedD}
              setExcluded={(s) => { setExcludedD(s); setSaved(false); }}
              open={openPanel === 'driver'}
              onToggle={() => toggle('driver')}
              formatValue={(v) => v != null ? `R${Number(v).toFixed(2)}` : '—'}
            />
          </div>
        </div>

        {/* ── Payment & Billing Defaults ───────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Payment &amp; Billing Defaults</h3>
          </div>

          <div className="divide-y divide-gray-100">

            {/* Payment method */}
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <label className="text-sm font-semibold text-gray-800">Payment Method</label>
              </div>
              <select
                value={form['standard_payment_method'] ?? ''}
                onChange={(e) => setField('standard_payment_method', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Select --</option>
                <option value="Client Pay">Client Pay</option>
                <option value="Debit Order">Debit Order</option>
                <option value="EFT">EFT</option>
              </select>
              <ExclusionPanel
                fieldLabel="Payment Method"
                newValue={form['standard_payment_method'] ?? ''}
                orgColumn="payment_method"
                orgs={orgs}
                orgsLoading={orgsLoading}
                excluded={excludedPM}
                setExcluded={(s) => { setExcludedPM(s); setSaved(false); }}
                open={openPanel === 'payment_method'}
                onToggle={() => toggle('payment_method')}
              />
            </div>

            {/* Payment terms */}
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-gray-400" />
                <label className="text-sm font-semibold text-gray-800">Payment Terms</label>
              </div>
              <select
                value={form['standard_payment_terms'] ?? ''}
                onChange={(e) => setField('standard_payment_terms', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Select --</option>
                <option value="Immediate">Immediate</option>
                <option value="Next Day">Next Day</option>
                <option value="7-Days">7-Days</option>
                <option value="14-Days">14-Days</option>
                <option value="30-Days">30-Days</option>
                <option value="60-Days">60-Days</option>
                <option value="90-Days">90-Days</option>
              </select>
              <ExclusionPanel
                fieldLabel="Payment Terms"
                newValue={form['standard_payment_terms'] ?? ''}
                orgColumn="payment_terms"
                orgs={orgs}
                orgsLoading={orgsLoading}
                excluded={excludedPT}
                setExcluded={(s) => { setExcludedPT(s); setSaved(false); }}
                open={openPanel === 'payment_terms'}
                onToggle={() => toggle('payment_terms')}
              />
            </div>

            {/* Payment date */}
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-gray-400" />
                <label className="text-sm font-semibold text-gray-800">Payment Date (Day of Month)</label>
              </div>
              <input
                type="number" min="1" max="31"
                value={form['standard_payment_date'] ?? ''}
                onChange={(e) => setField('standard_payment_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="1 – 31"
              />
              <ExclusionPanel
                fieldLabel="Payment Date"
                newValue={form['standard_payment_date'] ?? ''}
                orgColumn="payment_date"
                orgs={orgs}
                orgsLoading={orgsLoading}
                excluded={excludedPDate}
                setExcluded={(s) => { setExcludedPDate(s); setSaved(false); }}
                open={openPanel === 'payment_date'}
                onToggle={() => toggle('payment_date')}
                formatValue={(v) => v != null ? `Day ${v}` : '—'}
              />
            </div>

            {/* Debit order lead days */}
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-gray-400" />
                <label className="text-sm font-semibold text-gray-800">Debit Order Lead Time (Days)</label>
              </div>
              <input
                type="number" min="0"
                value={form['standard_debit_order_lead_days'] ?? ''}
                onChange={(e) => setField('standard_debit_order_lead_days', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. 3"
              />
              <p className="text-xs text-gray-500">Business days before the payment date that the debit order is submitted.</p>
              <ExclusionPanel
                fieldLabel="Debit Order Lead Time"
                newValue={form['standard_debit_order_lead_days'] ?? ''}
                orgColumn="debit_order_lead_days"
                orgs={orgs}
                orgsLoading={orgsLoading}
                excluded={excludedDO}
                setExcluded={(s) => { setExcludedDO(s); setSaved(false); }}
                open={openPanel === 'debit_order_lead'}
                onToggle={() => toggle('debit_order_lead')}
                formatValue={(v) => v != null ? `${v} day(s)` : '—'}
              />
            </div>

            {/* Late payment interest rate */}
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Percent className="w-4 h-4 text-gray-400" />
                <label className="text-sm font-semibold text-gray-800">Late Payment Interest Rate (%)</label>
              </div>
              <input
                type="text" inputMode="decimal"
                value={form['standard_late_payment_interest_rate'] ?? ''}
                onChange={(e) => setField('standard_late_payment_interest_rate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. 2.5"
              />
              <p className="text-xs text-gray-500">Annual interest rate applied to overdue invoices.</p>
              <ExclusionPanel
                fieldLabel="Interest Rate"
                newValue={form['standard_late_payment_interest_rate'] ?? ''}
                orgColumn="late_payment_interest_rate"
                orgs={orgs}
                orgsLoading={orgsLoading}
                excluded={excludedInt}
                setExcluded={(s) => { setExcludedInt(s); setSaved(false); }}
                open={openPanel === 'interest_rate'}
                onToggle={() => toggle('interest_rate')}
                formatValue={(v) => v != null ? `${Number(v).toFixed(2)}%` : '—'}
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
