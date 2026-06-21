import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, CheckCircle, XCircle, Loader2, Edit2, Save, X, AlertCircle, Ban, Power } from 'lucide-react';

interface Garage {
  id: string;
  name: string;
  city: string;
  province: string;
}

interface GarageAccount {
  id: string;
  garage_id: string;
  is_active: boolean;
  notes: string | null;
  account_number: string | null;
  monthly_spend_limit: number | null;
}

interface ClientGarageAccountsProps {
  organizationId: string;
  organizationName: string;
}

export default function ClientGarageAccounts({ organizationId, organizationName }: ClientGarageAccountsProps) {
  const [garages, setGarages] = useState<Garage[]>([]);
  const [garageAccounts, setGarageAccounts] = useState<GarageAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountNumberInput, setAccountNumberInput] = useState('');
  const [accountLimitInput, setAccountLimitInput] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedGarageForAccount, setSelectedGarageForAccount] = useState<Garage | null>(null);

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [garagesResult, accountsResult] = await Promise.all([
        supabase
          .from('garages')
          .select('id, name, city, province')
          .order('name'),
        supabase
          .from('organization_garage_accounts')
          .select('id, garage_id, is_active, notes, account_number, monthly_spend_limit')
          .eq('organization_id', organizationId),
      ]);

      if (garagesResult.error) throw garagesResult.error;
      if (accountsResult.error) throw accountsResult.error;

      setGarages(garagesResult.data || []);
      setGarageAccounts(accountsResult.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleAccountStatus = async (account: GarageAccount, newStatus: boolean) => {
    try {
      setSaving(account.id);
      setError('');

      const { error: updateError } = await supabase
        .from('organization_garage_accounts')
        .update({ is_active: newStatus })
        .eq('id', account.id);

      if (updateError) throw updateError;

      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const openAddModal = (garage: Garage) => {
    setSelectedGarageForAccount(garage);
    setAccountNumberInput('');
    setAccountLimitInput('');
    setShowAccountModal(true);
  };

  const handleSaveNewGarageAccount = async () => {
    if (!selectedGarageForAccount || !accountNumberInput.trim()) {
      setError('Account number is required');
      return;
    }

    try {
      setSaving(selectedGarageForAccount.id);
      setError('');

      const monthlySpendLimit = accountLimitInput.trim() ? parseFloat(accountLimitInput) : null;

      const { error: insertError } = await supabase
        .from('organization_garage_accounts')
        .insert({
          organization_id: organizationId,
          garage_id: selectedGarageForAccount.id,
          is_active: true,
          account_number: accountNumberInput.trim(),
          monthly_spend_limit: monthlySpendLimit,
        });

      if (insertError) throw insertError;

      await loadData();
      setShowAccountModal(false);
      setSelectedGarageForAccount(null);
      setAccountNumberInput('');
      setAccountLimitInput('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleCancelAccountModal = () => {
    setShowAccountModal(false);
    setSelectedGarageForAccount(null);
    setAccountNumberInput('');
    setAccountLimitInput('');
    setError('');
  };

  const isGarageActive = (garageId: string): boolean => {
    const account = garageAccounts.find(a => a.garage_id === garageId);
    return account ? account.is_active : false;
  };

  const getGarageAccount = (garageId: string): GarageAccount | undefined => {
    return garageAccounts.find(a => a.garage_id === garageId);
  };

  const handleEditAccount = (account: GarageAccount) => {
    setEditingAccountId(account.id);
    setAccountNumberInput(account.account_number || '');
    setAccountLimitInput(account.monthly_spend_limit ? account.monthly_spend_limit.toString() : '');
  };

  const handleSaveAccount = async (accountId: string) => {
    try {
      setSaving(accountId);
      setError('');

      const monthlySpendLimit = accountLimitInput.trim() ? parseFloat(accountLimitInput) : null;

      const { error: updateError } = await supabase
        .from('organization_garage_accounts')
        .update({
          account_number: accountNumberInput || null,
          monthly_spend_limit: monthlySpendLimit
        })
        .eq('id', accountId);

      if (updateError) throw updateError;

      await loadData();
      setEditingAccountId(null);
      setAccountNumberInput('');
      setAccountLimitInput('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setAccountNumberInput('');
    setAccountLimitInput('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="ml-2 text-xs text-gray-500">Loading garages...</span>
      </div>
    );
  }

  return (
    <>
      {/* Account Number Entry Modal */}
      {showAccountModal && selectedGarageForAccount && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && saving === null) {
              handleCancelAccountModal();
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Enter Account Number
                </h3>
                <p className="text-sm text-gray-600">
                  Adding <strong>{selectedGarageForAccount.name}</strong> to authorized garages
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Local Account Number <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={accountNumberInput}
                  onChange={(e) => setAccountNumberInput(e.target.value)}
                  placeholder="Enter the account number for this garage"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  This is the account number {organizationName} has with {selectedGarageForAccount.name}'s accounting system.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Spend Limit (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">R</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={accountLimitInput}
                    onChange={(e) => setAccountLimitInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Maximum monthly spending for {organizationName} at this garage (resets each month)
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-2">
                  <p className="text-xs text-red-800">{error}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelAccountModal}
                disabled={saving === selectedGarageForAccount.id}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewGarageAccount}
                disabled={!accountNumberInput.trim() || saving === selectedGarageForAccount.id}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving === selectedGarageForAccount.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Add Garage'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-gray-700">
            Select Garages Where {organizationName} Has Local Accounts
          </label>
          <span className="text-xs text-gray-500">
            {garageAccounts.filter(a => a.is_active).length} of {garages.length} selected
          </span>
        </div>

        {error && !showAccountModal && (
          <div className="bg-red-50 border border-red-200 rounded p-2">
            <p className="text-xs text-red-800">{error}</p>
          </div>
        )}

      <div className="space-y-4">
        {garages.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-500 border border-gray-300 rounded">
            No garages available. Please add garages to the system first.
          </div>
        ) : (
          <>
            {garageAccounts.filter(a => a.is_active).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-900 mb-2">Active Garages</h4>
                <div className="space-y-2 border border-amber-200 rounded-lg divide-y divide-amber-200">
                  {garageAccounts.filter(a => a.is_active).map((account) => {
                    const garage = garages.find(g => g.id === account.garage_id);
                    if (!garage) return null;

                    const isSaving = saving === account.id;
                    const isEditingAccount = editingAccountId === account.id;

                    return (
                      <div
                        key={account.id}
                        className="p-2 bg-amber-50"
                      >
                        <div className="flex items-center justify-between p-1">
                          <div className="flex items-center space-x-2 flex-1">
                            <Building2 className="w-4 h-4 text-amber-600" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-gray-900">{garage.name}</p>
                              <p className="text-xs text-gray-500">{garage.city}, {garage.province}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isEditingAccount && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleAccountStatus(account, false);
                                }}
                                disabled={isSaving}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded disabled:opacity-50"
                              >
                                <Ban className="w-3 h-3" />
                                Deactivate
                              </button>
                            )}
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                        </div>

                        <div className="mt-2 ml-6 pl-2 border-l-2 border-amber-300">
                          {isEditingAccount ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-gray-700 w-24">Account Number:</label>
                                <input
                                  type="text"
                                  value={accountNumberInput}
                                  onChange={(e) => setAccountNumberInput(e.target.value)}
                                  placeholder="Enter account number"
                                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-gray-700 w-24">Monthly Spend Limit:</label>
                                <div className="flex-1 relative">
                                  <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">R</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={accountLimitInput}
                                    onChange={(e) => setAccountLimitInput(e.target.value)}
                                    placeholder="No limit"
                                    className="w-full pl-6 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveAccount(account.id);
                                  }}
                                  disabled={isSaving}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                                >
                                  <Save className="w-3 h-3" />
                                  Save
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelEdit();
                                  }}
                                  disabled={isSaving}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                                >
                                  <X className="w-3 h-3" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 space-y-0.5">
                                  <p className="text-xs text-gray-600">
                                    <span className="font-medium">Account Number: </span>
                                    {account.account_number ? (
                                      <span className="text-gray-900 font-semibold">{account.account_number}</span>
                                    ) : (
                                      <span className="text-red-600 font-semibold">
                                        <AlertCircle className="w-3 h-3 inline" /> REQUIRED
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    <span className="font-medium">Monthly Spend Limit: </span>
                                    {account.monthly_spend_limit ? (
                                      <span className="text-gray-900 font-semibold">R {account.monthly_spend_limit.toFixed(2)}</span>
                                    ) : (
                                      <span className="text-gray-500 italic">No limit set</span>
                                    )}
                                  </p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditAccount(account);
                                  }}
                                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${account.account_number ? 'text-amber-700 bg-amber-100 hover:bg-amber-200' : 'text-red-700 bg-red-100 hover:bg-red-200 animate-pulse'}`}
                                >
                                  <Edit2 className="w-3 h-3" />
                                  Edit
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {garageAccounts.filter(a => !a.is_active).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-900 mb-2">Inactive Garages</h4>
                <div className="space-y-2 border border-gray-200 rounded-lg divide-y divide-gray-200">
                  {garageAccounts.filter(a => !a.is_active).map((account) => {
                    const garage = garages.find(g => g.id === account.garage_id);
                    if (!garage) return null;

                    const isSaving = saving === account.id;

                    return (
                      <div
                        key={account.id}
                        className="p-2 bg-gray-50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 flex-1">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-gray-900">{garage.name}</p>
                              <p className="text-xs text-gray-500">
                                {garage.city}, {garage.province}
                                {account.account_number && ` • Account: ${account.account_number}`}
                                {account.monthly_spend_limit && ` • Limit: R${account.monthly_spend_limit.toFixed(2)}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleAccountStatus(account, true)}
                              disabled={isSaving}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded disabled:opacity-50"
                            >
                              <Power className="w-3 h-3" />
                              Activate
                            </button>
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-300" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-gray-900 mb-2">Add New Garage</h4>
              <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg">
                {garages.filter(g => !garageAccounts.find(a => a.garage_id === g.id)).length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-500">
                    All garages have been added
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {garages.filter(g => !garageAccounts.find(a => a.garage_id === g.id)).map((garage) => {
                      const isSaving = saving === garage.id;
                      return (
                        <div
                          key={garage.id}
                          className="p-2 hover:bg-gray-50 cursor-pointer"
                          onClick={() => !isSaving && openAddModal(garage)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 flex-1">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-gray-900">{garage.name}</p>
                                <p className="text-xs text-gray-500">{garage.city}, {garage.province}</p>
                              </div>
                            </div>
                            <div className="flex items-center">
                              {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-amber-400" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Drivers from this organization will only be able to refuel at selected garages.
      </p>
      </div>
    </>
  );
}
