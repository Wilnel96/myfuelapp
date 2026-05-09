import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Save, X, AlertCircle, CheckCircle, ArrowLeft, Info } from 'lucide-react';

interface Setting {
  key: string;
  value: string;
  description: string;
}

interface ClientStandardSettingsProps {
  onBack: () => void;
}

const SETTING_KEYS = [
  'standard_monthly_fee_per_vehicle',
  'standard_payment_method',
  'standard_payment_terms',
  'standard_payment_date',
  'standard_debit_order_lead_days',
  'standard_late_payment_interest_rate',
];

const LABELS: Record<string, string> = {
  standard_monthly_fee_per_vehicle:    'Monthly Fee per Vehicle (R)',
  standard_payment_method:             'Payment Method',
  standard_payment_terms:              'Payment Terms',
  standard_payment_date:               'Payment Date (Day of Month)',
  standard_debit_order_lead_days:      'Debit Order Lead Time (Days)',
  standard_late_payment_interest_rate: 'Late Payment Interest Rate (%)',
};

export default function ClientStandardSettings({ onBack }: ClientStandardSettingsProps) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('global_settings')
        .select('key, value, description')
        .in('key', SETTING_KEYS);

      if (fetchError) throw fetchError;

      const map: Record<string, string> = {};
      (data as Setting[]).forEach((row) => { map[row.key] = row.value; });
      setSettings(map);
      setForm(map);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = SETTING_KEYS.some((k) => (form[k] ?? '') !== (settings[k] ?? ''));

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      for (const key of SETTING_KEYS) {
        const value = form[key] ?? '';
        const { error: upsertError } = await supabase
          .from('global_settings')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('key', key);
        if (upsertError) throw upsertError;
      }
      setSettings({ ...form });
      setSuccess('Standard settings saved successfully.');
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setForm({ ...settings });
    setSaved(false);
    setError('');
    setSuccess('');
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="-my-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white -mx-4 px-4 py-5 pb-4 border-b border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Client Standard Financial Settings</h2>
              <p className="text-gray-500 text-sm">System-wide defaults applied to all client organizations unless individually negotiated</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!saved && hasChanges && (
              <button
                onClick={handleDiscard}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <X className="w-4 h-4" />
                Discard
              </button>
            )}
            {saved ? (
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Close
              </button>
            ) : (
              <>
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5 max-w-2xl">
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
            These settings define the standard terms applied to all client organizations. Where a client has individually negotiated different terms, those are set directly on the client's financial info record and will override these defaults.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-100">
          {/* Monthly fee */}
          <div className="p-5 space-y-1.5">
            <label className="block text-sm font-semibold text-gray-800">
              {LABELS['standard_monthly_fee_per_vehicle']}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form['standard_monthly_fee_per_vehicle'] ?? ''}
              onChange={(e) => { setForm({ ...form, standard_monthly_fee_per_vehicle: e.target.value }); setSaved(false); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. 10.00"
            />
          </div>

          {/* Payment method */}
          <div className="p-5 space-y-1.5">
            <label className="block text-sm font-semibold text-gray-800">
              {LABELS['standard_payment_method']}
            </label>
            <select
              value={form['standard_payment_method'] ?? ''}
              onChange={(e) => { setForm({ ...form, standard_payment_method: e.target.value }); setSaved(false); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Select --</option>
              <option value="Client Pay">Client Pay</option>
              <option value="Debit Order">Debit Order</option>
              <option value="EFT">EFT</option>
            </select>
          </div>

          {/* Payment terms */}
          <div className="p-5 space-y-1.5">
            <label className="block text-sm font-semibold text-gray-800">
              {LABELS['standard_payment_terms']}
            </label>
            <select
              value={form['standard_payment_terms'] ?? ''}
              onChange={(e) => { setForm({ ...form, standard_payment_terms: e.target.value }); setSaved(false); }}
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
          </div>

          {/* Payment date */}
          <div className="p-5 space-y-1.5">
            <label className="block text-sm font-semibold text-gray-800">
              {LABELS['standard_payment_date']}
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={form['standard_payment_date'] ?? ''}
              onChange={(e) => { setForm({ ...form, standard_payment_date: e.target.value }); setSaved(false); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="1 – 31"
            />
          </div>

          {/* Debit order lead time */}
          <div className="p-5 space-y-1.5">
            <label className="block text-sm font-semibold text-gray-800">
              {LABELS['standard_debit_order_lead_days']}
            </label>
            <input
              type="number"
              min="0"
              value={form['standard_debit_order_lead_days'] ?? ''}
              onChange={(e) => { setForm({ ...form, standard_debit_order_lead_days: e.target.value }); setSaved(false); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. 3"
            />
            <p className="text-xs text-gray-500">Number of business days before the payment date that the debit order is submitted to the bank.</p>
          </div>

          {/* Late payment interest rate */}
          <div className="p-5 space-y-1.5">
            <label className="block text-sm font-semibold text-gray-800">
              {LABELS['standard_late_payment_interest_rate']}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form['standard_late_payment_interest_rate'] ?? ''}
              onChange={(e) => { setForm({ ...form, standard_late_payment_interest_rate: e.target.value }); setSaved(false); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. 2.5"
            />
            <p className="text-xs text-gray-500">Annual interest rate applied to overdue invoices.</p>
          </div>
        </div>
      </div>
    </div>
  );
}