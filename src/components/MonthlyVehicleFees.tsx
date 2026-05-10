import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Save, AlertCircle, CheckCircle, ArrowLeft, RefreshCw, Info, Car, Users } from 'lucide-react';

interface StandardMonthlyFeesProps {
  onBack: () => void;
}

interface OrgFeeRow {
  id: string;
  name: string;
  monthly_fee_per_vehicle: number | null;
  monthly_fee_per_driver: number | null;
  vehicle_count: number;
  driver_count: number;
}

export default function MonthlyVehicleFees({ onBack }: StandardMonthlyFeesProps) {
  const [globalVehicleFee, setGlobalVehicleFee] = useState<string>('');
  const [newVehicleFee, setNewVehicleFee] = useState<string>('');
  const [globalDriverFee, setGlobalDriverFee] = useState<string>('');
  const [newDriverFee, setNewDriverFee] = useState<string>('');
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
      const [vehicleSettingRes, driverSettingRes, orgsRes] = await Promise.all([
        supabase.from('global_settings').select('value').eq('key', 'monthly_fee_per_vehicle').maybeSingle(),
        supabase.from('global_settings').select('value').eq('key', 'monthly_fee_per_driver').maybeSingle(),
        supabase
          .from('organizations')
          .select('id, name, monthly_fee_per_vehicle, monthly_fee_per_driver')
          .eq('organization_type', 'client')
          .eq('is_management_org', false)
          .order('name'),
      ]);

      if (vehicleSettingRes.error) throw vehicleSettingRes.error;
      if (driverSettingRes.error) throw driverSettingRes.error;
      if (orgsRes.error) throw orgsRes.error;

      const vFee = vehicleSettingRes.data?.value ?? '10';
      const dFee = driverSettingRes.data?.value ?? '0';
      setGlobalVehicleFee(vFee);
      setNewVehicleFee(vFee);
      setGlobalDriverFee(dFee);
      setNewDriverFee(dFee);

      const orgIds = (orgsRes.data ?? []).map((o) => o.id);
      let vehicleCounts: Record<string, number> = {};
      let driverCounts: Record<string, number> = {};

      if (orgIds.length > 0) {
        const [vehiclesRes, driversRes] = await Promise.all([
          supabase.from('vehicles').select('organization_id').in('organization_id', orgIds).eq('status', 'active'),
          supabase.from('drivers').select('organization_id').in('organization_id', orgIds).eq('status', 'active'),
        ]);

        (vehiclesRes.data ?? []).forEach((v) => {
          vehicleCounts[v.organization_id] = (vehicleCounts[v.organization_id] ?? 0) + 1;
        });
        (driversRes.data ?? []).forEach((d) => {
          driverCounts[d.organization_id] = (driverCounts[d.organization_id] ?? 0) + 1;
        });
      }

      setOrgs(
        (orgsRes.data ?? []).map((o) => ({
          id: o.id,
          name: o.name,
          monthly_fee_per_vehicle: o.monthly_fee_per_vehicle,
          monthly_fee_per_driver: o.monthly_fee_per_driver,
          vehicle_count: vehicleCounts[o.id] ?? 0,
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
    const parsedV = parseFloat(newVehicleFee);
    const parsedD = parseFloat(newDriverFee);
    if (isNaN(parsedV) || parsedV < 0 || isNaN(parsedD) || parsedD < 0) {
      setError('Please enter valid fee amounts');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const now = new Date().toISOString();

      const [vErr, dErr] = await Promise.all([
        supabase.from('global_settings')
          .update({ value: parsedV.toString(), updated_at: now, updated_by: user.id })
          .eq('key', 'monthly_fee_per_vehicle')
          .then((r) => r.error),
        supabase.from('global_settings')
          .update({ value: parsedD.toString(), updated_at: now, updated_by: user.id })
          .eq('key', 'monthly_fee_per_driver')
          .then((r) => r.error),
      ]);

      if (vErr) throw vErr;
      if (dErr) throw dErr;

      setGlobalVehicleFee(parsedV.toString());
      setGlobalDriverFee(parsedD.toString());

      if (applyToAll) {
        setApplying(true);
        const { error: updateErr } = await supabase
          .from('organizations')
          .update({ monthly_fee_per_vehicle: parsedV, monthly_fee_per_driver: parsedD })
          .eq('organization_type', 'client')
          .eq('is_management_org', false);

        if (updateErr) throw updateErr;

        setOrgs((prev) =>
          prev.map((o) => ({ ...o, monthly_fee_per_vehicle: parsedV, monthly_fee_per_driver: parsedD }))
        );
        setSuccess(
          `Fees updated (Vehicle: R${parsedV.toFixed(2)}, Driver: R${parsedD.toFixed(2)}) and applied to all ${orgs.length} client organisation(s).`
        );
      } else {
        setSuccess(
          `Fees updated (Vehicle: R${parsedV.toFixed(2)}, Driver: R${parsedD.toFixed(2)}). Existing clients were not changed.`
        );
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

  const parsedNewV = parseFloat(newVehicleFee);
  const parsedGlobalV = parseFloat(globalVehicleFee);
  const parsedNewD = parseFloat(newDriverFee);
  const parsedGlobalD = parseFloat(globalDriverFee);

  const vehicleFeeChanged = newVehicleFee !== globalVehicleFee;
  const driverFeeChanged = newDriverFee !== globalDriverFee;
  const anyChanged = vehicleFeeChanged || driverFeeChanged;

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
          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Standard Monthly Fees</h2>
            <p className="text-sm text-gray-500">Set the default rates charged per active vehicle and driver each month</p>
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
        <h3 className="text-base font-semibold text-gray-900 mb-1">Standard Rates</h3>
        <p className="text-sm text-gray-500 mb-5">
          System-wide defaults. New client accounts are automatically assigned these rates.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Vehicle fee */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
              <Car className="w-3.5 h-3.5 text-teal-500" />
              Fee per vehicle per month (R)
            </label>
            <div className="flex items-center gap-3">
              <div className="relative w-40">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">R</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newVehicleFee}
                  onChange={(e) => { setNewVehicleFee(e.target.value); setSuccess(''); }}
                  onFocus={(e) => e.target.select()}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              {!isNaN(parsedNewV) && !isNaN(parsedGlobalV) && vehicleFeeChanged && (
                <span className={`text-xs font-medium px-2 py-1 rounded ${parsedNewV > parsedGlobalV ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                  {parsedNewV > parsedGlobalV ? `+R${(parsedNewV - parsedGlobalV).toFixed(2)}` : `-R${(parsedGlobalV - parsedNewV).toFixed(2)}`}
                </span>
              )}
            </div>
          </div>

          {/* Driver fee */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              Fee per driver per month (R)
            </label>
            <div className="flex items-center gap-3">
              <div className="relative w-40">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">R</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newDriverFee}
                  onChange={(e) => { setNewDriverFee(e.target.value); setSuccess(''); }}
                  onFocus={(e) => e.target.select()}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {!isNaN(parsedNewD) && !isNaN(parsedGlobalD) && driverFeeChanged && (
                <span className={`text-xs font-medium px-2 py-1 rounded ${parsedNewD > parsedGlobalD ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                  {parsedNewD > parsedGlobalD ? `+R${(parsedNewD - parsedGlobalD).toFixed(2)}` : `-R${(parsedGlobalD - parsedNewD).toFixed(2)}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Apply to all toggle */}
        <div className="mt-5 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Apply to all existing clients</span>
              <p className="text-xs text-gray-500 mt-0.5">
                Update both fees for all {orgs.length} existing client organisation(s) to match these new rates.
                Uncheck to only update the defaults for new sign-ups going forward.
              </p>
            </div>
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || applying || !anyChanged || isNaN(parsedNewV) || parsedNewV < 0 || isNaN(parsedNewD) || parsedNewD < 0}
            className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {applying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {applying ? 'Applying to all clients...' : saving ? 'Saving...' : 'Save Changes'}
          </button>

          {!anyChanged && !success && (
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
            <p className="text-xs text-gray-500 mt-0.5">Current fees assigned to each client organisation</p>
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
            <div className="grid grid-cols-5 gap-3 px-6 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span className="col-span-1">Organisation</span>
              <span className="text-center">Vehicles</span>
              <span className="text-right">Fee / Vehicle</span>
              <span className="text-center">Drivers</span>
              <span className="text-right">Fee / Driver</span>
            </div>
            {orgs.map((org) => {
              const vDiffers = org.monthly_fee_per_vehicle != null && Math.abs(org.monthly_fee_per_vehicle - parsedGlobalV) > 0.001;
              const dDiffers = org.monthly_fee_per_driver != null && Math.abs(org.monthly_fee_per_driver - parsedGlobalD) > 0.001;
              return (
                <div key={org.id} className="grid grid-cols-5 gap-3 px-6 py-3 items-center hover:bg-gray-50 transition-colors">
                  <span className="col-span-1 text-sm font-medium text-gray-900 truncate">{org.name}</span>
                  <span className="text-sm text-gray-600 text-center">{org.vehicle_count}</span>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${vDiffers ? 'text-amber-600' : 'text-gray-900'}`}>
                      {formatFee(org.monthly_fee_per_vehicle)}
                    </span>
                    {vDiffers && <span className="ml-1 text-xs text-amber-500">(custom)</span>}
                  </div>
                  <span className="text-sm text-gray-600 text-center">{org.driver_count}</span>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${dDiffers ? 'text-amber-600' : 'text-gray-900'}`}>
                      {formatFee(org.monthly_fee_per_driver)}
                    </span>
                    {dDiffers && <span className="ml-1 text-xs text-amber-500">(custom)</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-1.5 text-xs text-gray-500">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          Rows marked <span className="text-amber-600 font-medium mx-1">(custom)</span> differ from the current global rates
          (Vehicle: R{parseFloat(globalVehicleFee || '0').toFixed(2)}, Driver: R{parseFloat(globalDriverFee || '0').toFixed(2)}).
        </div>
      </div>
    </div>
  );
}
