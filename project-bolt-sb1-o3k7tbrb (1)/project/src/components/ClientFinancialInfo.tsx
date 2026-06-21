import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, CreditCard as Edit2, Save, X, AlertCircle, CheckCircle, Search, ArrowLeft, CreditCard } from 'lucide-react';
import { OrganizationPaymentCardReadOnly } from './OrganizationPaymentCardReadOnly';
import ClientGarageAccounts from './ClientGarageAccounts';

interface Organization {
  id: string;
  name: string;
  monthly_fee_per_vehicle: number | null;
  monthly_fee_per_driver: number | null;
  daily_spending_limit: number | null;
  monthly_spending_limit: number | null;
  month_end_day: number | null;
  year_end_month: number | null;
  year_end_day: number | null;
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
  bank_branch_code: string | null;
  bank_account_type: string | null;
  bank_name_2: string | null;
  bank_account_holder_2: string | null;
  bank_account_number_2: string | null;
  bank_branch_code_2: string | null;
  bank_account_type_2: string | null;
  payment_method: string | null;
  payment_terms: string | null;
  payment_date: number | null;
  debit_order_lead_days: number | null;
  late_payment_interest_rate: number | null;
  enable_prorata_billing: boolean | null;
  vat_reporting_basis: string | null;
  credit_control_enabled: boolean | null;
  suspend_services_after_days: number | null;
  payment_option: string | null;
  fuel_payment_terms: string | null;
  fuel_payment_interest_rate: number | null;
}

interface ClientFinancialInfoProps {
  onNavigate?: (view: string) => void;
  /** When true, loads only the logged-in user's own organisation instead of the full list */
  clientSelfMode?: boolean;
  /** Where the back button navigates to. Defaults to 'client-organizations-menu' */
  backView?: string;
}

export default function ClientFinancialInfo({ onNavigate, clientSelfMode = false, backView = 'client-organizations-menu' }: ClientFinancialInfoProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saved, setSaved] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editForm, setEditForm] = useState<Partial<Organization>>({});
  const [canEdit, setCanEdit] = useState(!clientSelfMode);

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredOrganizations(organizations);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = organizations.filter((org) =>
        org.name.toLowerCase().includes(term) ||
        (org.bank_account_holder || '').toLowerCase().includes(term) ||
        (org.bank_account_holder_2 || '').toLowerCase().includes(term)
      );
      setFilteredOrganizations(filtered);
    }
  }, [searchTerm, organizations]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);

      const cols = 'id, name, monthly_fee_per_vehicle, monthly_fee_per_driver, daily_spending_limit, monthly_spending_limit, month_end_day, year_end_month, year_end_day, bank_name, bank_account_holder, bank_account_number, bank_branch_code, bank_account_type, bank_name_2, bank_account_holder_2, bank_account_number_2, bank_branch_code_2, bank_account_type_2, payment_method, payment_terms, payment_date, debit_order_lead_days, late_payment_interest_rate, enable_prorata_billing, vat_reporting_basis, credit_control_enabled, suspend_services_after_days, payment_option, fuel_payment_terms, fuel_payment_interest_rate';

      let query = supabase.from('organizations').select(cols);

      if (clientSelfMode) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const { data: profile } = await supabase
          .from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
        if (!profile?.organization_id) throw new Error('No organisation found for your account');
        query = query.eq('id', profile.organization_id);
      } else {
        query = query
          .eq('organization_type', 'client')
          .neq('name', 'My Organization')
          .neq('name', 'FUEL EMPOWERMENT SYSTEMS (PTY) LTD')
          .order('name');
      }

      const { data: orgs, error: orgsError } = await query;

      if (orgsError) throw orgsError;
      setOrganizations(orgs || []);
      setFilteredOrganizations(orgs || []);

      // In clientSelfMode, auto-open the single org for editing
      if (clientSelfMode && orgs && orgs.length === 1) {
        // Check if user can edit financial data
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: orgUser } = await supabase
            .from('organization_users')
            .select('is_main_user, is_secondary_main_user, can_view_financial_data')
            .eq('user_id', authUser.id)
            .eq('is_active', true)
            .maybeSingle();
          const full = orgUser?.is_main_user || orgUser?.is_secondary_main_user || false;
          const allowed = full || orgUser?.can_view_financial_data || false;
          setCanEdit(allowed);
          if (allowed) {
            setEditingId(orgs[0].id);
            setEditForm(orgs[0]);
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (org: Organization) => {
    setEditingId(org.id);
    setEditForm(org);
    setSaved(false);
    setError('');
    setSuccess('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setSaved(false);
  };

  const handleSave = async () => {
    if (!editingId) return;

    try {
      setError('');
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          monthly_fee_per_vehicle: editForm.monthly_fee_per_vehicle,
          monthly_fee_per_driver: editForm.monthly_fee_per_driver,
          daily_spending_limit: editForm.daily_spending_limit,
          monthly_spending_limit: editForm.monthly_spending_limit,
          month_end_day: editForm.month_end_day,
          year_end_month: editForm.year_end_month,
          year_end_day: editForm.year_end_day,
          bank_name: editForm.bank_name,
          bank_account_holder: editForm.bank_account_holder,
          bank_account_number: editForm.bank_account_number,
          bank_branch_code: editForm.bank_branch_code,
          bank_account_type: editForm.bank_account_type,
          bank_name_2: editForm.bank_name_2,
          bank_account_holder_2: editForm.bank_account_holder_2,
          bank_account_number_2: editForm.bank_account_number_2,
          bank_branch_code_2: editForm.bank_branch_code_2,
          bank_account_type_2: editForm.bank_account_type_2,
          payment_method: editForm.payment_method,
          payment_terms: editForm.payment_terms,
          payment_date: editForm.payment_date,
          debit_order_lead_days: editForm.debit_order_lead_days,
          late_payment_interest_rate: editForm.late_payment_interest_rate,
          enable_prorata_billing: editForm.enable_prorata_billing,
          vat_reporting_basis: editForm.vat_reporting_basis,
          credit_control_enabled: editForm.credit_control_enabled,
          suspend_services_after_days: editForm.suspend_services_after_days,
          payment_option: editForm.payment_option,
          fuel_payment_terms: editForm.fuel_payment_terms,
          fuel_payment_interest_rate: editForm.fuel_payment_interest_rate,
        })
        .eq('id', editingId);

      if (updateError) throw updateError;

      setSuccess('Financial information updated successfully');
      setSaved(true);

      // Refresh list in background without triggering the loading spinner
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, monthly_fee_per_vehicle, monthly_fee_per_driver, daily_spending_limit, monthly_spending_limit, month_end_day, year_end_month, year_end_day, bank_name, bank_account_holder, bank_account_number, bank_branch_code, bank_account_type, bank_name_2, bank_account_holder_2, bank_account_number_2, bank_branch_code_2, bank_account_type_2, payment_method, payment_terms, payment_date, debit_order_lead_days, late_payment_interest_rate, enable_prorata_billing, vat_reporting_basis, credit_control_enabled, suspend_services_after_days, payment_option, fuel_payment_terms, fuel_payment_interest_rate')
        .eq('organization_type', 'client')
        .neq('name', 'My Organization')
        .neq('name', 'FUEL EMPOWERMENT SYSTEMS (PTY) LTD')
        .order('name');
      if (orgs) {
        setOrganizations(orgs);
        setFilteredOrganizations(orgs);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading financial information...</div>;
  }

  return (
    <div className="-my-6">
      <div className="sticky top-0 z-10 bg-white -mx-4 px-4 py-6 pb-4 border-b border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-emerald-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {clientSelfMode ? 'Financial Information' : (editingId ? 'Changing Client Financial Info' : 'Client Financial Info')}
              </h2>
              <p className="text-gray-600 text-sm">
                {editingId ? 'Update banking and financial details' : 'Manage banking and financial details'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {editingId ? (
              <>
                <button
                  onClick={() => {
                    handleCancelEdit();
                    if (onNavigate) onNavigate(backView);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back to Menu
                </button>
                {!saved && canEdit && (
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <Save className="w-5 h-5" />
                    Save Changes
                  </button>
                )}
              </>
            ) : (
              onNavigate && (
                <button
                  onClick={() => onNavigate(backView)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  {clientSelfMode ? 'Back to Back Office' : 'Back to Client Organization Info'}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
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

      {!editingId && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      )}

      <div className="space-y-2">
        {filteredOrganizations.map((org) => {
          if (editingId && editingId !== org.id) return null;

          return (
          <div key={org.id} className="bg-white border border-gray-200 rounded-lg p-3">
            {editingId === org.id ? (
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-gray-900 pb-2 border-b">{org.name}</h3>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Monthly Fee Per Vehicle (R)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editForm.monthly_fee_per_vehicle ?? 0}
                      onChange={(e) =>
                        setEditForm({ ...editForm, monthly_fee_per_vehicle: parseFloat(e.target.value) })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Monthly Fee Per Driver (R)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editForm.monthly_fee_per_driver ?? 0}
                      onChange={(e) =>
                        setEditForm({ ...editForm, monthly_fee_per_driver: parseFloat(e.target.value) })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Month End Day
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={editForm.month_end_day || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, month_end_day: e.target.value ? parseInt(e.target.value) : null })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      placeholder="1-31"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Year End Month
                    </label>
                    <select
                      value={editForm.year_end_month || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, year_end_month: e.target.value ? parseInt(e.target.value) : null })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    >
                      <option value="">Select Month</option>
                      <option value="1">January</option>
                      <option value="2">February</option>
                      <option value="3">March</option>
                      <option value="4">April</option>
                      <option value="5">May</option>
                      <option value="6">June</option>
                      <option value="7">July</option>
                      <option value="8">August</option>
                      <option value="9">September</option>
                      <option value="10">October</option>
                      <option value="11">November</option>
                      <option value="12">December</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Year End Day
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={editForm.year_end_day || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, year_end_day: e.target.value ? parseInt(e.target.value) : null })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      placeholder="1-31"
                    />
                  </div>
                </div>

                <div className="border-t pt-2 mt-2">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Fee Invoice Configuration (Payable to MyFuelApp Management)</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Payment Method</label>
                      <select
                        value={editForm.payment_method || ''}
                        onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      >
                        <option value="">-- Select --</option>
                        <option value="Client Pay">Client Pay</option>
                        <option value="Debit Order">Debit Order</option>
                        <option value="EFT">EFT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Payment Terms</label>
                      <select
                        value={editForm.payment_terms || ''}
                        onChange={(e) => setEditForm({ ...editForm, payment_terms: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
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
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Payment Date (Day of Month)</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={editForm.payment_date || ''}
                        onChange={(e) => setEditForm({ ...editForm, payment_date: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                        placeholder="1-31"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Debit Order Lead Days</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.debit_order_lead_days || ''}
                        onChange={(e) => setEditForm({ ...editForm, debit_order_lead_days: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                        placeholder="e.g. 5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Late Payment Interest Rate (%)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editForm.late_payment_interest_rate || ''}
                        onChange={(e) => setEditForm({ ...editForm, late_payment_interest_rate: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                        placeholder="e.g. 2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">VAT Reporting Basis</label>
                      <select
                        value={editForm.vat_reporting_basis || ''}
                        onChange={(e) => setEditForm({ ...editForm, vat_reporting_basis: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      >
                        <option value="">-- Select --</option>
                        <option value="Accrual">Accrual</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`prorata-${editingId}`}
                        checked={editForm.enable_prorata_billing || false}
                        onChange={(e) => setEditForm({ ...editForm, enable_prorata_billing: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                      />
                      <label htmlFor={`prorata-${editingId}`} className="text-xs font-medium text-gray-700">
                        Enable Pro-rata Billing
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`credit-control-${editingId}`}
                        checked={editForm.credit_control_enabled || false}
                        onChange={(e) => setEditForm({ ...editForm, credit_control_enabled: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                      />
                      <label htmlFor={`credit-control-${editingId}`} className="text-xs font-medium text-gray-700">
                        Enable Credit Control
                      </label>
                    </div>
                    {editForm.credit_control_enabled && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Suspend Services After (Days)</label>
                        <input
                          type="number"
                          min="0"
                          value={editForm.suspend_services_after_days || ''}
                          onChange={(e) => setEditForm({ ...editForm, suspend_services_after_days: e.target.value ? parseInt(e.target.value) : null })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                          placeholder="e.g. 30"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-2 mt-2">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Fuel Payment Configuration (Client to Garages)</h4>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-0.5">
                          Daily Fuel Spend Limit (R)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="No limit"
                          value={editForm.daily_spending_limit ?? ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, daily_spending_limit: e.target.value ? parseFloat(e.target.value) : null })
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-0.5">
                          Monthly Fuel Spend Limit (R)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="No limit"
                          value={editForm.monthly_spending_limit ?? ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, monthly_spending_limit: e.target.value ? parseFloat(e.target.value) : null })
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Fuel Payment Option</label>
                      <select
                        value={editForm.payment_option || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          payment_option: e.target.value,
                          fuel_payment_terms: null,
                          fuel_payment_interest_rate: null,
                        })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      >
                        <option value="">-- Select --</option>
                        <option value="Card Payment">Credit/Debit Card Payment</option>
                        <option value="Local Account">Local Account</option>
                      </select>
                    </div>

                    {editForm.payment_option === 'Card Payment' && editingId && (
                      <div className="bg-white border border-blue-200 rounded p-2">
                        <OrganizationPaymentCardReadOnly organizationId={editingId} organizationName={editForm.name || ''} />
                      </div>
                    )}

                    {editForm.payment_option === 'Local Account' && editingId && (
                      <div className="bg-amber-50 border border-amber-200 rounded p-2 space-y-3">
                        <p className="text-xs text-amber-900 font-medium">
                          Client has local accounts with garages. MyFuelApp manages fuel transactions and billing. Client pays MyFuelApp for management fees only. Fuel costs are settled through existing local account arrangements.
                        </p>
                        <p className="text-xs text-amber-800 italic">
                          Each garage has its own till/accounting system. Enter the client's specific account number for each garage below.
                        </p>
                        <div className="border-t border-amber-300 pt-2">
                          <ClientGarageAccounts organizationId={editingId} organizationName={editForm.name || ''} />
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                <div className="border-t pt-2 mt-2">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Primary Bank Account</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Holder</label>
                      <input
                        type="text"
                        value={editForm.bank_account_holder || ''}
                        onChange={(e) => setEditForm({ ...editForm, bank_account_holder: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Number</label>
                      <input
                        type="text"
                        value={editForm.bank_account_number || ''}
                        onChange={(e) => setEditForm({ ...editForm, bank_account_number: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Bank Name</label>
                      <input
                        type="text"
                        value={editForm.bank_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, bank_name: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Branch Code</label>
                      <input
                        type="text"
                        value={editForm.bank_branch_code || ''}
                        onChange={(e) => setEditForm({ ...editForm, bank_branch_code: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Type</label>
                      <select
                        value={editForm.bank_account_type || 'cheque'}
                        onChange={(e) => setEditForm({ ...editForm, bank_account_type: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      >
                        <option value="cheque">Current Account</option>
                        <option value="savings">Savings</option>
                        <option value="transmission">Transmission</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-2 mt-2">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Secondary Bank Account (Optional)</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Holder</label>
                      <input
                        type="text"
                        value={editForm.bank_account_holder_2 || ''}
                        onChange={(e) => setEditForm({ ...editForm, bank_account_holder_2: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Number</label>
                      <input
                        type="text"
                        value={editForm.bank_account_number_2 || ''}
                        onChange={(e) => setEditForm({ ...editForm, bank_account_number_2: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Bank Name</label>
                      <input
                        type="text"
                        value={editForm.bank_name_2 || ''}
                        onChange={(e) => setEditForm({ ...editForm, bank_name_2: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Branch Code</label>
                      <input
                        type="text"
                        value={editForm.bank_branch_code_2 || ''}
                        onChange={(e) => setEditForm({ ...editForm, bank_branch_code_2: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Type</label>
                      <select
                        value={editForm.bank_account_type_2 || ''}
                        onChange={(e) => setEditForm({ ...editForm, bank_account_type_2: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      >
                        <option value="">-- Select --</option>
                        <option value="cheque">Current Account</option>
                        <option value="savings">Savings</option>
                        <option value="transmission">Transmission</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900">{org.name}</h3>
                  <div className="text-xs text-gray-600 mt-1 space-y-1">
                    <p>
                      <span className="font-medium">Vehicle Fee:</span> R{org.monthly_fee_per_vehicle?.toFixed(2) || '0.00'}/vehicle •
                      <span className="font-medium"> Driver Fee:</span> R{org.monthly_fee_per_driver?.toFixed(2) || '0.00'}/driver •
                      <span className="font-medium"> Month End:</span> {org.month_end_day || 'N/A'}
                    </p>
                    <p>
                      <span className="font-medium">Fee Payment:</span> {org.payment_method || 'Not Set'}
                      {org.payment_terms && ` (${org.payment_terms})`}
                    </p>
                    <p>
                      <span className="font-medium">Fuel Payment:</span> {
                        org.payment_option === 'Card Payment' ? 'Credit/Debit Card Payment' : org.payment_option || 'Not Set'
                      }
                      {org.payment_option === 'EFT Payment' && org.fuel_payment_terms && ` (${org.fuel_payment_terms})`}
                      {org.fuel_payment_interest_rate && org.fuel_payment_terms !== 'Same Day' &&
                        ` • ${org.fuel_payment_interest_rate}% interest`}
                    </p>
                  </div>
                </div>
                {canEdit && (
                <button
                  onClick={() => handleEdit(org)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
                )}
              </div>
            )}
          </div>
          );
        })}

        {filteredOrganizations.length === 0 && (
          <div className="text-center py-8 text-gray-500">No organizations found</div>
        )}
      </div>
      </div>
    </div>
  );
}
