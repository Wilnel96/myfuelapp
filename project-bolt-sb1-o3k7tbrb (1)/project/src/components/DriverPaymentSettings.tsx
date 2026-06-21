import React, { useState, useEffect } from 'react';
import { DollarSign, Lock, Unlock, AlertCircle, CheckCircle2, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Driver {
  id: string;
  first_name: string;
  surname: string;
}

interface PaymentSettings {
  id: string;
  driver_id: string;
  daily_spending_limit: number;
  monthly_spending_limit: number;
  payment_enabled: boolean;
  is_pin_active: boolean;
  failed_pin_attempts: number;
  locked_until: string | null;
  last_payment_at: string | null;
}

interface SpendingData {
  daily_spent: number;
  monthly_spent: number;
  daily_limit: number;
  monthly_limit: number;
}

interface DriverPaymentSettingsProps {
  driverId: string;
  onClose: () => void;
}

export function DriverPaymentSettings({ driverId, onClose }: DriverPaymentSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [driver, setDriver] = useState<Driver | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [spendingData, setSpendingData] = useState<SpendingData | null>(null);

  const [formData, setFormData] = useState({
    dailyLimit: 5000,
    monthlyLimit: 50000,
    paymentEnabled: true,
    dailyLimitEnabled: true,
    monthlyLimitEnabled: true,
  });

  useEffect(() => {
    loadDriverData();
  }, [driverId]);

  const loadDriverData = async () => {
    try {
      setLoading(true);

      const [driverResult, settingsResult, spendingResult] = await Promise.all([
        supabase
          .from('drivers')
          .select('id, first_name, surname')
          .eq('id', driverId)
          .single(),
        supabase
          .from('driver_payment_settings')
          .select('*')
          .eq('driver_id', driverId)
          .maybeSingle(),
        supabase
          .rpc('get_driver_current_spending', { p_driver_id: driverId })
          .maybeSingle(),
      ]);

      if (driverResult.data) {
        setDriver(driverResult.data);
      }

      if (settingsResult.data) {
        setSettings(settingsResult.data);

        const newFormData = {
          dailyLimit: settingsResult.data.daily_spending_limit ? Number(settingsResult.data.daily_spending_limit) : 5000,
          monthlyLimit: settingsResult.data.monthly_spending_limit ? Number(settingsResult.data.monthly_spending_limit) : 50000,
          paymentEnabled: settingsResult.data.payment_enabled,
          dailyLimitEnabled: settingsResult.data.daily_spending_limit !== null,
          monthlyLimitEnabled: settingsResult.data.monthly_spending_limit !== null,
        };

        console.log('Driver Payment Settings loaded:', {
          raw_daily_limit: settingsResult.data.daily_spending_limit,
          raw_monthly_limit: settingsResult.data.monthly_spending_limit,
          parsed_form_data: newFormData
        });

        setFormData(newFormData);
      }

      if (spendingResult.data) {
        setSpendingData(spendingResult.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load driver data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const updatePayload = {
        daily_spending_limit: formData.dailyLimitEnabled ? formData.dailyLimit : null,
        monthly_spending_limit: formData.monthlyLimitEnabled ? formData.monthlyLimit : null,
        payment_enabled: formData.paymentEnabled,
      };

      console.log('Attempting to update driver payment settings:', {
        driver_id: driverId,
        form_state: formData,
        update_payload: updatePayload,
      });

      const { data, error: updateError, count } = await supabase
        .from('driver_payment_settings')
        .update(updatePayload)
        .eq('driver_id', driverId)
        .select();

      console.log('Update result:', {
        data,
        error: updateError,
        count,
        error_details: updateError ? {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        } : null
      });

      if (updateError) throw updateError;

      if (!data || data.length === 0) {
        throw new Error('No rows were updated. This may be a permissions issue.');
      }

      setSuccess('Payment settings updated successfully!');
      await loadDriverData();
    } catch (err: any) {
      console.error('Error updating payment settings:', err);
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlock = async () => {
    try {
      setSaving(true);
      setError('');

      const { error: updateError } = await supabase
        .from('driver_payment_settings')
        .update({
          failed_pin_attempts: 0,
          locked_until: null,
        })
        .eq('driver_id', driverId);

      if (updateError) throw updateError;

      setSuccess('Driver account unlocked successfully!');
      await loadDriverData();
    } catch (err: any) {
      setError(err.message || 'Failed to unlock account');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPIN = async () => {
    if (!confirm('This will completely reset the driver\'s PIN. They will need to set up a new PIN on their next login. Continue?')) {
      return;
    }

    try {
      setSaving(true);
      setError('');

      const { error: updateError } = await supabase
        .from('driver_payment_settings')
        .update({
          pin_hash: null,
          pin_salt: null,
          is_pin_active: false,
          require_pin_change: false,
          failed_pin_attempts: 0,
          locked_until: null,
        })
        .eq('driver_id', driverId);

      if (updateError) throw updateError;

      setSuccess('PIN has been reset. Driver must set up a new PIN on next login.');
      await loadDriverData();
    } catch (err: any) {
      setError(err.message || 'Failed to reset PIN');
    } finally {
      setSaving(false);
    }
  };

  const getProgressColor = (spent: number, limit: number): string => {
    const percentage = (spent / limit) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getProgressPercentage = (spent: number, limit: number): number => {
    return Math.min((spent / limit) * 100, 100);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!driver || !settings) {
    return null;
  }

  const isLocked = settings.locked_until && new Date(settings.locked_until) > new Date();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            Payment Settings: {driver.first_name} {driver.surname}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {spendingData && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>Current Spending</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">Daily Spending</p>
                  <p className="text-2xl font-bold mb-2">
                    R{spendingData.daily_spent.toFixed(2)}
                  </p>
                  {spendingData.daily_limit !== null ? (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div
                          className={`h-2 rounded-full transition-all ${getProgressColor(spendingData.daily_spent, spendingData.daily_limit)}`}
                          style={{ width: `${getProgressPercentage(spendingData.daily_spent, spendingData.daily_limit)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Limit: R{spendingData.daily_limit.toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-green-600 font-medium mt-2">
                      No daily limit (unlimited)
                    </p>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">Monthly Spending</p>
                  <p className="text-2xl font-bold mb-2">
                    R{spendingData.monthly_spent.toFixed(2)}
                  </p>
                  {spendingData.monthly_limit !== null ? (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div
                          className={`h-2 rounded-full transition-all ${getProgressColor(spendingData.monthly_spent, spendingData.monthly_limit)}`}
                          style={{ width: `${getProgressPercentage(spendingData.monthly_spent, spendingData.monthly_limit)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Limit: R{spendingData.monthly_limit.toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-green-600 font-medium mt-2">
                      No monthly limit (unlimited)
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Payment Status</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">PIN Status</p>
                <p className={`font-medium ${settings.is_pin_active ? 'text-green-600' : 'text-yellow-600'}`}>
                  {settings.is_pin_active ? 'Active' : 'Not Set'}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Account Status</p>
                <p className={`font-medium ${isLocked ? 'text-red-600' : 'text-green-600'}`}>
                  {isLocked ? 'Locked' : 'Active'}
                </p>
              </div>
            </div>

            {settings.failed_pin_attempts > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  Failed PIN attempts: {settings.failed_pin_attempts}/3
                </p>
              </div>
            )}

            {isLocked && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 mb-3">
                  Account is locked until {new Date(settings.locked_until!).toLocaleString()}
                </p>
                <button
                  onClick={handleUnlock}
                  disabled={saving}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:bg-gray-400 flex items-center space-x-2"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Unlock Account</span>
                </button>
              </div>
            )}

            {settings.last_payment_at && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Last Payment</p>
                <p className="font-medium flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(settings.last_payment_at).toLocaleString()}</span>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 flex items-center space-x-2">
              <DollarSign className="w-5 h-5" />
              <span>Spending Limits</span>
            </h3>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-blue-900 mb-2">Understanding Spending Limits:</p>
              <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                <li><strong>Check "No Limit"</strong> = Driver can spend any amount (UNLIMITED)</li>
                <li><strong>Uncheck "No Limit" and set R0</strong> = Driver is BLOCKED from all purchases</li>
                <li><strong>Uncheck "No Limit" and set any amount</strong> = Driver can spend up to that amount</li>
              </ul>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Daily Spending Limit (R)
                </label>
                <label className="flex items-center space-x-2 text-sm cursor-pointer bg-yellow-100 px-3 py-2 rounded-lg border-2 border-yellow-400">
                  <input
                    type="checkbox"
                    checked={!formData.dailyLimitEnabled}
                    onChange={(e) => setFormData({ ...formData, dailyLimitEnabled: !e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-900 font-semibold">No Limit (Unlimited)</span>
                </label>
              </div>
              <input
                type="number"
                value={formData.dailyLimit}
                onChange={(e) => setFormData({ ...formData, dailyLimit: Number(e.target.value) })}
                disabled={!formData.dailyLimitEnabled}
                min="0"
                step="100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
              />
              <div className="mt-2 p-3 rounded-lg border-2" style={{
                backgroundColor: !formData.dailyLimitEnabled ? '#f0fdf4' : formData.dailyLimit === 0 ? '#fef2f2' : '#f9fafb',
                borderColor: !formData.dailyLimitEnabled ? '#86efac' : formData.dailyLimit === 0 ? '#fca5a5' : '#e5e7eb'
              }}>
                {formData.dailyLimitEnabled ? (
                  <>
                    {formData.dailyLimit === 0 ? (
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-red-700">SPENDING BLOCKED</p>
                          <p className="text-xs text-red-600">R0.00 = Driver cannot make ANY purchases</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-5 h-5 text-gray-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Daily Limit Set</p>
                          <p className="text-xs text-gray-600">Driver can spend up to <strong>R{formData.dailyLimit.toFixed(2)}</strong> per day</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-green-700">UNLIMITED</p>
                      <p className="text-xs text-green-600">No daily spending restrictions</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Monthly Spending Limit (R)
                </label>
                <label className="flex items-center space-x-2 text-sm cursor-pointer bg-yellow-100 px-3 py-2 rounded-lg border-2 border-yellow-400">
                  <input
                    type="checkbox"
                    checked={!formData.monthlyLimitEnabled}
                    onChange={(e) => setFormData({ ...formData, monthlyLimitEnabled: !e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-900 font-semibold">No Limit (Unlimited)</span>
                </label>
              </div>
              <input
                type="number"
                value={formData.monthlyLimit}
                onChange={(e) => setFormData({ ...formData, monthlyLimit: Number(e.target.value) })}
                disabled={!formData.monthlyLimitEnabled}
                min="0"
                step="1000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
              />
              <div className="mt-2 p-3 rounded-lg border-2" style={{
                backgroundColor: !formData.monthlyLimitEnabled ? '#f0fdf4' : formData.monthlyLimit === 0 ? '#fef2f2' : '#f9fafb',
                borderColor: !formData.monthlyLimitEnabled ? '#86efac' : formData.monthlyLimit === 0 ? '#fca5a5' : '#e5e7eb'
              }}>
                {formData.monthlyLimitEnabled ? (
                  <>
                    {formData.monthlyLimit === 0 ? (
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-red-700">SPENDING BLOCKED</p>
                          <p className="text-xs text-red-600">R0.00 = Driver cannot make ANY purchases</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-5 h-5 text-gray-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Monthly Limit Set</p>
                          <p className="text-xs text-gray-600">Driver can spend up to <strong>R{formData.monthlyLimit.toFixed(2)}</strong> per month</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-green-700">UNLIMITED</p>
                      <p className="text-xs text-green-600">No monthly spending restrictions</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Enable NFC Payments</p>
                <p className="text-sm text-gray-500">Allow driver to make instant NFC payments</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.paymentEnabled}
                  onChange={(e) => setFormData({ ...formData, paymentEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-gray-900 flex items-center space-x-2">
              <Lock className="w-5 h-5" />
              <span>Security Actions</span>
            </h3>

            <button
              onClick={handleResetPIN}
              disabled={saving}
              className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 text-sm font-medium"
            >
              Reset PIN (Forgotten PIN)
            </button>
            <p className="text-xs text-gray-500 px-1">
              Completely resets the driver's PIN. Use this when a driver has forgotten their PIN. They will be required to set up a new PIN on their next login.
            </p>
          </div>

          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
