import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Save, AlertCircle, CheckCircle, ArrowLeft, RefreshCw, Info } from 'lucide-react';

interface MonthlyDriverFeesProps {
  onBack: () => void;
}

interface OrgFeeRow {
  id: string;
  name: string;
  monthly_fee_per_driver: number | null;
  driver_count: number;
}

export default function MonthlyDriverFees({ onBack }: MonthlyDriverFeesProps) {
  const [globalFee, setGlobalFee] = useState<string>('');
  const [newFee, setNewFee] = useState<string>('');
  const [orgs, setOrgs] = useState<OrgFeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [applyToAll, setApplyToAll] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [settingRes, orgsRes] = await Promise.all([
        supabase
          .from('global_settings')
          .select('value')
          .eq('key', 'monthly_fee_per_driver')
          .maybeSingle(),
        supabase
          .from('organizations')
          .select('id, name, monthly_fee_per_driver')
          .eq('organization_type', 'client')
          .eq('is_management_org', false)
          .order('name'),
      ]);

      if (settingRes.error) throw settingRes.error;
      if (orgsRes.error) throw orgsRes.error;

      const currentFee = settingRes.data?.value ?? '0';
      setGlobalFee(currentFee);
      setNewFee(currentFee);

      const orgIds = (orgsRes.data ?? []).map((o) => o.id);
      let driverCounts: Record<string, number> = {};

      if (orgIds.length > 0) {
        const { data: drivers } = await supabase
          .from('drivers')
          .select('organization_id')
          .in('organization_id', orgIds)
          .eq('status', 'active');

        (drivers ?? []).forEach((d) => {
          driverCounts[d.organization_id] = (driverCounts[d.organization_id] ?? 0) + 1;
        });
      }

      setOrgs(
        (orgsRes.data ?? []).map((o) => ({
          id: o.id,
          name: o.name,
          monthly_fee_per_driver: o.monthly_fee_per_driver,
          driver_count: driverCounts[o.id] ?? 0,
        }))
      );
    } catch (err: any) {
      setError(err.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const parsed = parseFloat(newFee);
    if (isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid fee amount');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: settingErr } = await supabase
        .from('global_settings')
        .update({ value: parsed.toString(), updated_at: new Date().toISOString(), updated_by: user.id })
        .eq('key', 'monthly_fee_per_driver');

      if (settingErr) throw settingErr;

      setGlobalFee(parsed.toString());

      if (applyToAll) {
        setApplying(true);
        const { error: updateErr } = await supabase
          .from('organizations')
          .update({ monthly_fee_per_driver: parsed })
          .eq('organization_type', 'client')
          .eq('is_management_org', false);

        if (updateErr) throw updateErr;

        setOrgs((prev) => prev.map((o) => ({ ...o, monthly_fee_per_driver: parsed })));
        setSuccess(`Global fee updated to R${parsed.toFixed(2)} and applied to all ${orgs.length} client organisation(s).`);
      } else {
        setSuccess(`Global fee updated to R${parsed.toFixed(2)}. Existing clients were not changed.`);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
      setApplying(false);
    }
  };

  const formatFee = (fee: number | null) =>
    fee == null ? <span className="text-gray-400 italic">Not set</span> : `R${Number(fee).toFixed(2)}`;

  const feeChanged = newFee !== globalFee;
  const parsedNew = parseFloat(newFee);
  const parsedGlobal = parseFloat(globalFee);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Monthly Driver Fees</h2>
            <p className="text-sm text-gray-500">Set the default rate charged per active driver each month</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      {/* Fee setting card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Standard Rate</h3>
        <p className="text-sm text-gray-500 mb-5">
          This is the system-wide default. New client accounts will automatically be assigned this rate.
        </p>

        <div className="flex items-end gap-4">
          <div className="w-48">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Fee per driver per month (R)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">R</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newFee}
                onChange={(e) => { setNewFee(e.target.value); setSuccess(''); }}
                onFocus={(e) => e.target.select()}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {!isNaN(parsedNew) && !isNaN(parsedGlobal) && feeChanged && (
            <div className={`text-sm font-medium px-3 py-2 rounded-lg ${parsedNew > parsedGlobal ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
              {parsedNew > parsedGlobal
                ? `+R${(parsedNew - parsedGlobal).toFixed(2)} increase`
                : `-R${(parsedGlobal - parsedNew).toFixed(2)} decrease`}
            </div>
          )}
        </div>

        {/* Apply to all toggle */}
        <div className="mt-5 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Apply to all existing clients</span>
              <p className="text-xs text-gray-500 mt-0.5">
                Update the monthly fee for all {orgs.length} existing client organisation(s) to match this new rate.
                Uncheck to only update the default for new sign-ups going forward.
              </p>
            </div>
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || applying || !feeChanged || isNaN(parsedNew) || parsedNew < 0}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {applying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {applying ? 'Applying to all clients...' : saving ? 'Saving...' : 'Save Changes'}
          </button>

          {!feeChanged && !success && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              No changes to save
            </span>
          )}
        </div>
      </div>

      {/* Per-client overview table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Client Rate Overview</h3>
            <p className="text-xs text-gray-500 mt-0.5">Current fee assigned to each client organisation</p>
          </div>
          <button
            onClick={load}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : orgs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No client organisations found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="grid grid-cols-3 gap-4 px-6 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Organisation</span>
              <span className="text-center">Active Drivers</span>
              <span className="text-right">Monthly Fee / Driver</span>
            </div>
            {orgs.map((org) => {
              const differsFromGlobal =
                org.monthly_fee_per_driver != null &&
                Math.abs(org.monthly_fee_per_driver - parsedGlobal) > 0.001;
              return (
                <div key={org.id} className="grid grid-cols-3 gap-4 px-6 py-3 items-center hover:bg-gray-50 transition-colors">
                  <span className="text-sm font-medium text-gray-900 truncate">{org.name}</span>
                  <span className="text-sm text-gray-600 text-center">{org.driver_count}</span>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${differsFromGlobal ? 'text-amber-600' : 'text-gray-900'}`}>
                      {formatFee(org.monthly_fee_per_driver)}
                    </span>
                    {differsFromGlobal && (
                      <span className="ml-2 text-xs text-amber-500">(custom)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-1.5 text-xs text-gray-500">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          Rows marked <span className="text-amber-600 font-medium mx-1">(custom)</span> differ from the current global rate of R{parseFloat(globalFee || '0').toFixed(2)}.
        </div>
      </div>
    </div>
  );
}
