import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Save, AlertCircle, CheckCircle } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  company_registration_number: string;
  vat_number: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  website: string;
  monthly_fee_per_vehicle: string;
  month_end_day: string;
  year_end_month: string;
  year_end_day: string;
  bank_name: string;
  bank_account_holder: string;
  bank_account_number: string;
  bank_branch_code: string;
  bank_account_type: string;
  bank_name_2: string;
  bank_account_holder_2: string;
  bank_account_number_2: string;
  bank_branch_code_2: string;
  bank_account_type_2: string;
}

export default function OrganizationInfo() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [isManagementOrg, setIsManagementOrg] = useState(false);

  useEffect(() => {
    loadOrganization();
    checkEditPermission();
  }, []);

  const checkEditPermission = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orgUser } = await supabase
        .from('organization_users')
        .select('is_main_user, can_edit_organization_info')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      const mainUser = orgUser?.is_main_user || false;
      const hasEditPermission = orgUser?.can_edit_organization_info || false;

      setCanEdit(mainUser || hasEditPermission);
    } catch (err) {
      console.error('Error checking edit permission:', err);
    }
  };

  const loadOrganization = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.organization_id) throw new Error('No organization found');

      const { data, error: fetchError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (data) {
        setOrganization(data);
        setIsManagementOrg(data.name === 'FUEL EMPOWERMENT SYSTEMS (PTY) LTD');
      }
    } catch (err: any) {
      console.error('Error loading organization:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!organization) return;

    if (!canEdit) {
      setError('You do not have permission to edit organization information');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          company_registration_number: organization.company_registration_number,
          vat_number: organization.vat_number,
          address_line_1: organization.address_line_1,
          address_line_2: organization.address_line_2,
          city: organization.city,
          province: organization.province,
          postal_code: organization.postal_code,
          country: organization.country,
          website: organization.website,
          month_end_day: organization.month_end_day,
          year_end_month: organization.year_end_month,
          year_end_day: organization.year_end_day,
          bank_name: organization.bank_name,
          bank_account_holder: organization.bank_account_holder,
          bank_account_number: organization.bank_account_number,
          bank_branch_code: organization.bank_branch_code,
          bank_account_type: organization.bank_account_type,
          bank_name_2: organization.bank_name_2,
          bank_account_holder_2: organization.bank_account_holder_2,
          bank_account_number_2: organization.bank_account_number_2,
          bank_branch_code_2: organization.bank_branch_code_2,
          bank_account_type_2: organization.bank_account_type_2,
        })
        .eq('id', organization.id);

      if (updateError) throw updateError;
      setSuccess('Organization information updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error saving organization:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No organization information found</p>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-1">Access Restricted</h3>
            <p className="text-yellow-800 text-sm">
              You do not have permission to modify Organization Information. Only the Main User or users with "Can Edit Organization Info" permission can make changes. Please contact your administrator.
            </p>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg p-4 border border-yellow-200">
          <h4 className="font-semibold text-gray-900 mb-3">Organization Information (View Only)</h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Organization:</span>
              <p className="text-gray-900">{organization.name}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Registration Number:</span>
              <p className="text-gray-900">{organization.company_registration_number || 'Not set'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">VAT Number:</span>
              <p className="text-gray-900">{organization.vat_number || 'Not set'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Website:</span>
              <p className="text-gray-900">{organization.website || 'Not set'}</p>
            </div>
            <div className="col-span-2">
              <span className="font-medium text-gray-700">Address:</span>
              <div className="text-gray-900">
                {organization.address_line_1 && <p>{organization.address_line_1}</p>}
                {organization.address_line_2 && <p>{organization.address_line_2}</p>}
                {(organization.city || organization.province || organization.postal_code) && (
                  <p>
                    {organization.city}{organization.city && organization.province ? ', ' : ''}{organization.province} {organization.postal_code}
                  </p>
                )}
                {organization.country && <p>{organization.country}</p>}
                {!organization.address_line_1 && 'Not set'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-my-6">
      <div className="sticky top-0 z-30 bg-white -mx-4 px-4 py-3 border-b border-gray-200 mb-6">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">
            {isManagementOrg ? 'Management Organization Information' : 'Organization Information'}
          </h2>
        </div>
      </div>

      <div className="space-y-6">
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

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Organization Details
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name
              </label>
              <input
                type="text"
                value={organization.name}
                disabled
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Cannot be changed</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Registration Number
                </label>
                <input
                  type="text"
                  value={organization.company_registration_number}
                  onChange={(e) => setOrganization({ ...organization, company_registration_number: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VAT Number
                </label>
                <input
                  type="text"
                  value={organization.vat_number}
                  onChange={(e) => setOrganization({ ...organization, vat_number: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={organization.website}
                  onChange={(e) => setOrganization({ ...organization, website: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Fee Per Vehicle (ZAR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={organization.monthly_fee_per_vehicle}
                disabled
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Managed by System Administrator</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Month End Day
                </label>
                <select
                  value={organization.month_end_day}
                  onChange={(e) => setOrganization({ ...organization, month_end_day: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Day</option>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year End Month
                </label>
                <select
                  value={organization.year_end_month}
                  onChange={(e) => setOrganization({ ...organization, year_end_month: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Month</option>
                  <option value="January">January</option>
                  <option value="February">February</option>
                  <option value="March">March</option>
                  <option value="April">April</option>
                  <option value="May">May</option>
                  <option value="June">June</option>
                  <option value="July">July</option>
                  <option value="August">August</option>
                  <option value="September">September</option>
                  <option value="October">October</option>
                  <option value="November">November</option>
                  <option value="December">December</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year End Day
                </label>
                <select
                  value={organization.year_end_day}
                  onChange={(e) => setOrganization({ ...organization, year_end_day: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Day</option>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Physical Address</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 1
              </label>
              <input
                type="text"
                value={organization.address_line_1}
                onChange={(e) => setOrganization({ ...organization, address_line_1: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 2
              </label>
              <input
                type="text"
                value={organization.address_line_2}
                onChange={(e) => setOrganization({ ...organization, address_line_2: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={organization.city}
                  onChange={(e) => setOrganization({ ...organization, city: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Province
                </label>
                <select
                  value={organization.province}
                  onChange={(e) => setOrganization({ ...organization, province: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Province</option>
                  <option value="Eastern Cape">Eastern Cape</option>
                  <option value="Free State">Free State</option>
                  <option value="Gauteng">Gauteng</option>
                  <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                  <option value="Limpopo">Limpopo</option>
                  <option value="Mpumalanga">Mpumalanga</option>
                  <option value="Northern Cape">Northern Cape</option>
                  <option value="North West">North West</option>
                  <option value="Western Cape">Western Cape</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={organization.postal_code}
                  onChange={(e) => setOrganization({ ...organization, postal_code: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={organization.country}
                  onChange={(e) => setOrganization({ ...organization, country: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="South Africa"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Banking Details - Primary Account</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={organization.bank_name}
                onChange={(e) => setOrganization({ ...organization, bank_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Holder Name
              </label>
              <input
                type="text"
                value={organization.bank_account_holder}
                onChange={(e) => setOrganization({ ...organization, bank_account_holder: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={organization.bank_account_number}
                onChange={(e) => setOrganization({ ...organization, bank_account_number: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch Code
              </label>
              <input
                type="text"
                value={organization.bank_branch_code}
                onChange={(e) => setOrganization({ ...organization, bank_branch_code: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Type
              </label>
              <select
                value={organization.bank_account_type}
                onChange={(e) => setOrganization({ ...organization, bank_account_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Type</option>
                <option value="Current">Current</option>
                <option value="Savings">Savings</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Banking Details - Secondary Account (Optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={organization.bank_name_2}
                onChange={(e) => setOrganization({ ...organization, bank_name_2: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Holder Name
              </label>
              <input
                type="text"
                value={organization.bank_account_holder_2}
                onChange={(e) => setOrganization({ ...organization, bank_account_holder_2: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={organization.bank_account_number_2}
                onChange={(e) => setOrganization({ ...organization, bank_account_number_2: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch Code
              </label>
              <input
                type="text"
                value={organization.bank_branch_code_2}
                onChange={(e) => setOrganization({ ...organization, bank_branch_code_2: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Type
              </label>
              <select
                value={organization.bank_account_type_2}
                onChange={(e) => setOrganization({ ...organization, bank_account_type_2: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Type</option>
                <option value="Current">Current</option>
                <option value="Savings">Savings</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
