import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, User, Save, AlertCircle, CheckCircle } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  account_type: string;
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

interface OrgUser {
  phone_mobile: string;
  phone_office: string;
  email: string;
  id_number: string;
}

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function OrganizationInfo() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgUser, setOrgUser] = useState<OrgUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [isManagementOrg, setIsManagementOrg] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.organization_id) throw new Error('No organization found');

      const [{ data: org, error: orgError }, { data: ouData }] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', profile.organization_id).maybeSingle(),
        supabase.from('organization_users')
          .select('phone_mobile, phone_office, email, id_number, is_main_user, can_edit_organization_info, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle(),
      ]);

      if (orgError) throw orgError;
      if (org) {
        setOrganization(org);
        setIsManagementOrg(org.name === 'FUEL EMPOWERMENT SYSTEMS (PTY) LTD');
      }
      if (ouData) {
        setOrgUser({
          phone_mobile: ouData.phone_mobile || '',
          phone_office: ouData.phone_office || '',
          email: ouData.email || '',
          id_number: ouData.id_number || '',
        });
        setCanEdit(ouData.is_main_user || ouData.can_edit_organization_info || false);
      }
    } catch (err: any) {
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

      const isIndividual = organization.account_type === 'individual';

      const updatePayload: Record<string, unknown> = {
        company_registration_number: organization.company_registration_number,
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
      };

      updatePayload.address_line_1 = organization.address_line_1;
      updatePayload.address_line_2 = organization.address_line_2;
      updatePayload.city = organization.city;
      updatePayload.province = organization.province;
      updatePayload.postal_code = organization.postal_code;

      if (!isIndividual) {
        updatePayload.vat_number = organization.vat_number;
        updatePayload.country = organization.country;
      }

      const { error: updateError } = await supabase
        .from('organizations')
        .update(updatePayload)
        .eq('id', organization.id);

      if (updateError) throw updateError;

      if (isIndividual && orgUser && currentUserId) {
        const { data: profile } = await supabase
          .from('profiles').select('organization_id').eq('id', currentUserId).maybeSingle();

        if (profile?.organization_id) {
          await supabase.from('organization_users').update({
            phone_mobile: orgUser.phone_mobile,
            phone_office: orgUser.phone_office,
          }).eq('user_id', currentUserId).eq('organization_id', profile.organization_id);
        }
      }

      setSuccess('Information updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
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

  const isIndividual = organization.account_type === 'individual';
  const accountLabel = isIndividual ? 'Individual' : 'Organization';
  const Icon = isIndividual ? User : Building2;

  if (!canEdit) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-1">Access Restricted</h3>
            <p className="text-yellow-800 text-sm">
              You do not have permission to modify {accountLabel} Information. Only the Main User or users
              with "Can Edit Organization Info" permission can make changes. Please contact your administrator.
            </p>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg p-4 border border-yellow-200">
          <h4 className="font-semibold text-gray-900 mb-3">{accountLabel} Information (View Only)</h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">{isIndividual ? 'Name' : 'Organization'}:</span>
              <p className="text-gray-900">{organization.name}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">{isIndividual ? 'ID Number' : 'Registration Number'}:</span>
              <p className="text-gray-900">{organization.company_registration_number || 'Not set'}</p>
            </div>
            {!isIndividual && (
              <>
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
                        {organization.city}
                        {organization.city && organization.province ? ', ' : ''}
                        {organization.province} {organization.postal_code}
                      </p>
                    )}
                    {!organization.address_line_1 && 'Not set'}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-my-6">
      <div className="sticky top-0 z-30 bg-white -mx-4 px-4 py-3 border-b border-gray-200 mb-6">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">
            {isManagementOrg ? 'Management Organization Information' : `${accountLabel} Information`}
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

          {isIndividual ? (
            /* --- INDIVIDUAL LAYOUT --- */
            <>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Personal Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={organization.name}
                      disabled
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-1">Cannot be changed. Contact your administrator.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                      <input
                        type="text"
                        value={organization.company_registration_number}
                        onChange={(e) => setOrganization({ ...organization, company_registration_number: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        maxLength={13}
                        placeholder="13-digit SA ID number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={orgUser?.email || ''}
                        disabled
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-600"
                      />
                      <p className="text-xs text-gray-500 mt-1">Linked to your login account</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Phone</label>
                      <input
                        type="tel"
                        value={orgUser?.phone_mobile || ''}
                        onChange={(e) => setOrgUser(prev => prev ? { ...prev, phone_mobile: e.target.value } : prev)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Office Phone</label>
                      <input
                        type="tel"
                        value={orgUser?.phone_office || ''}
                        onChange={(e) => setOrgUser(prev => prev ? { ...prev, phone_office: e.target.value } : prev)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Physical Address</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={organization.address_line_1}
                      onChange={(e) => setOrganization({ ...organization, address_line_1: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      placeholder="Street address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                    <input
                      type="text"
                      value={organization.address_line_2}
                      onChange={(e) => setOrganization({ ...organization, address_line_2: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      placeholder="Suburb, unit, etc."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={organization.city}
                        onChange={(e) => setOrganization({ ...organization, city: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                      <select
                        value={organization.province}
                        onChange={(e) => setOrganization({ ...organization, province: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Province</option>
                        {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={organization.postal_code}
                        onChange={(e) => setOrganization({ ...organization, postal_code: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Period Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Month End Day</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year End Month</label>
                    <select
                      value={organization.year_end_month}
                      onChange={(e) => setOrganization({ ...organization, year_end_month: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Month</option>
                      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year End Day</label>
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
            </>
          ) : (
            /* --- COMPANY / ORGANIZATION LAYOUT --- */
            <>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Organization Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Registration Number</label>
                      <input
                        type="text"
                        value={organization.company_registration_number}
                        onChange={(e) => setOrganization({ ...organization, company_registration_number: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
                      <input
                        type="text"
                        value={organization.vat_number}
                        onChange={(e) => setOrganization({ ...organization, vat_number: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                      <input
                        type="url"
                        value={organization.website}
                        onChange={(e) => setOrganization({ ...organization, website: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Fee Per Vehicle (ZAR)</label>
                      <input
                        type="number"
                        value={organization.monthly_fee_per_vehicle}
                        disabled
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-600"
                      />
                      <p className="text-xs text-gray-500 mt-1">Managed by System Administrator</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Month End Day</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Year End Month</label>
                      <select
                        value={organization.year_end_month}
                        onChange={(e) => setOrganization({ ...organization, year_end_month: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Month</option>
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Year End Day</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={organization.address_line_1}
                      onChange={(e) => setOrganization({ ...organization, address_line_1: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                    <input
                      type="text"
                      value={organization.address_line_2}
                      onChange={(e) => setOrganization({ ...organization, address_line_2: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={organization.city}
                        onChange={(e) => setOrganization({ ...organization, city: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                      <select
                        value={organization.province}
                        onChange={(e) => setOrganization({ ...organization, province: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Province</option>
                        {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={organization.postal_code}
                        onChange={(e) => setOrganization({ ...organization, postal_code: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
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
            </>
          )}

          {/* Banking — same for both account types */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Banking Details - Primary Account</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                { label: 'Bank Name', field: 'bank_name' },
                { label: 'Account Holder Name', field: 'bank_account_holder' },
                { label: 'Account Number', field: 'bank_account_number' },
                { label: 'Branch Code', field: 'bank_branch_code' },
              ] as { label: string; field: keyof Organization }[]).map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    value={organization[field] as string}
                    onChange={(e) => setOrganization({ ...organization, [field]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
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
              {([
                { label: 'Bank Name', field: 'bank_name_2' },
                { label: 'Account Holder Name', field: 'bank_account_holder_2' },
                { label: 'Account Number', field: 'bank_account_number_2' },
                { label: 'Branch Code', field: 'bank_branch_code_2' },
              ] as { label: string; field: keyof Organization }[]).map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    value={organization[field] as string}
                    onChange={(e) => setOrganization({ ...organization, [field]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
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
