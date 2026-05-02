import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Save, AlertCircle, CheckCircle, Copy } from 'lucide-react';

interface CreateClientOrganizationProps {
  onNavigate?: (view: string) => void;
}

export default function CreateClientOrganization({ onNavigate }: CreateClientOrganizationProps) {
  const [step, setStep] = useState<'type-selection' | 'details'>('type-selection');
  const [accountType, setAccountType] = useState<'organization' | 'individual' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [componentError, setComponentError] = useState<string | null>(null);

  // Wrap all state updates in try-catch
  const safeSetFormData = (updater: any) => {
    try {
      setFormData(updater);
    } catch (err: any) {
      console.error('Error updating form data:', err);
      setError('An error occurred while updating the form');
    }
  };

  const safeSetBillingContact = (updater: any) => {
    try {
      setBillingContact(updater);
    } catch (err: any) {
      console.error('Error updating billing contact:', err);
      setError('An error occurred while updating billing contact');
    }
  };

  const safeSetMainUser = (updater: any) => {
    try {
      setMainUser(updater);
    } catch (err: any) {
      console.error('Error updating main user:', err);
      setError('An error occurred while updating main user');
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    company_registration_number: '',
    vat_number: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    province: '',
    postal_code: '',
    country: 'South Africa',
    website: '',
    monthly_fee_per_vehicle: 0,
    month_end_day: 25,
    year_end_month: 2,
    year_end_day: 28,
    daily_spending_limit: null as number | null,
    monthly_spending_limit: null as number | null,
    payment_option: null as 'Card Payment' | 'Local Account' | null,
    fuel_payment_terms: null as 'Same Day' | 'Next Day' | '30-Days' | null,
    fuel_payment_interest_rate: null as number | null,
  });

  const [mainUser, setMainUser] = useState({
    name: '',
    surname: '',
    email: '',
    password: '',
    phone_office: '',
    phone_mobile: '',
  });

  const [billingContact, setBillingContact] = useState({
    name: '',
    surname: '',
    email: '',
    password: '',
    phone_office: '',
    phone_mobile: '',
    can_add_vehicles: false,
    can_edit_vehicles: false,
    can_delete_vehicles: false,
    can_add_drivers: false,
    can_edit_drivers: false,
    can_delete_drivers: false,
    can_view_reports: true,
    can_edit_organization_info: false,
    can_view_fuel_transactions: true,
    can_create_reports: true,
    can_view_custom_reports: true,
    can_manage_users: false,
    can_view_financial_data: true,
  });

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        console.log('[CreateClient] Checking permissions...');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('[CreateClient] Not authenticated');
          setComponentError('Not authenticated');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile?.organization_id) {
          console.error('[CreateClient] No organization found');
          setComponentError('No organization found');
          return;
        }

        const { data: parentOrg } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('id', profile.organization_id)
          .maybeSingle();

        if (!parentOrg) {
          console.error('[CreateClient] Parent organization not found');
          setComponentError('Parent organization not found');
          return;
        }

        if (parentOrg.name !== 'FUEL EMPOWERMENT SYSTEMS (PTY) LTD') {
          console.error('[CreateClient] Not management organization');
          setComponentError('Only management organization can create client organizations');
          return;
        }

        console.log('[CreateClient] Permissions check passed');
      } catch (err: any) {
        console.error('[CreateClient] Error checking permissions:', err);
        setComponentError(err.message || 'Failed to verify permissions');
      }
    };

    checkPermissions();
  }, []);

  // Global error boundary
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[CreateClient] Global error caught:', event.error);
      event.preventDefault();
      setComponentError('An unexpected error occurred. Please try refreshing the page.');
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  const copyMainUserToBilling = () => {
    try {
      safeSetBillingContact({
        ...billingContact,
        name: mainUser.name,
        surname: mainUser.surname,
        email: mainUser.email,
        password: mainUser.password,
        phone_office: mainUser.phone_office,
        phone_mobile: mainUser.phone_mobile,
      });
      setSuccess('Main User information copied to Billing User successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('[CreateClient] Error copying main user:', err);
      setError('Failed to copy Main User information');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.organization_id) throw new Error('No organization found');

      const { data: parentOrg } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', profile.organization_id)
        .maybeSingle();

      if (!parentOrg) throw new Error('Parent organization not found');
      if (parentOrg.name !== 'FUEL EMPOWERMENT SYSTEMS (PTY) LTD') {
        throw new Error('Only management organization can create client organizations');
      }

      // Sanitize formData - convert empty strings to null for optional fields
      const sanitizedFormData = {
        ...formData,
        payment_option: formData.payment_option || null,
        fuel_payment_terms: formData.fuel_payment_terms || null,
        fuel_payment_interest_rate: formData.fuel_payment_interest_rate || null,
        daily_spending_limit: formData.daily_spending_limit || null,
        monthly_spending_limit: formData.monthly_spending_limit || null,
        website: formData.website || null,
        address_line_2: formData.address_line_2 || null,
      };

      // Check if organization name already exists
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('name', formData.name.toUpperCase().trim())
        .maybeSingle();

      if (existingOrg) {
        throw new Error(`An organization with the name "${formData.name}" already exists. Please use a different name.`);
      }

      // Create the organization (billing user will be stored in organization_users table)
      const { data: newOrg, error: insertError } = await supabase
        .from('organizations')
        .insert({
          ...sanitizedFormData,
          name: formData.name.toUpperCase().trim(),
          organization_type: 'client',
          is_management_org: false,
          status: 'active',
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505' && insertError.message.includes('organizations_name_key')) {
          throw new Error(`An organization with the name "${formData.name}" already exists. Please use a different name.`);
        }
        throw insertError;
      }
      if (!newOrg) throw new Error('Failed to create organization');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-organization-users`;

      // Check if main user and billing user are the same person (same email)
      const isSameUser = mainUser.email.toLowerCase().trim() === billingContact.email.toLowerCase().trim();

      // NOTE: Billing user info is stored ONLY in organization_users table
      // - If same person: Create 1 user (main user with is_main_user=true)
      //   They can also be given "Billing User" title if needed
      // - If different: Create 2 users (main user + separate billing user with title "Billing User")

      if (isSameUser) {
        // Create only one user (main user who is also the billing user)
        // Give them "Main User" title since they're the primary contact
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organization_id: newOrg.id,
            users: [{
              email: mainUser.email,
              password: mainUser.password,
              name: mainUser.name,
              surname: mainUser.surname,
              phone_office: mainUser.phone_office || null,
              phone_mobile: mainUser.phone_mobile || null,
              is_main_user: true,
              role: 'admin',
            }],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create user');
        }
      } else {
        // Create main user
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organization_id: newOrg.id,
            users: [{
              email: mainUser.email,
              password: mainUser.password,
              name: mainUser.name,
              surname: mainUser.surname,
              phone_office: mainUser.phone_office || null,
              phone_mobile: mainUser.phone_mobile || null,
              is_main_user: true,
              role: 'admin',
            }],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create main user');
        }

        // Create billing user (separate person)
        const billingResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organization_id: newOrg.id,
            users: [{
              email: billingContact.email,
              password: billingContact.password,
              name: billingContact.name,
              surname: billingContact.surname,
              title: 'Billing User',
              phone_office: billingContact.phone_office || null,
              phone_mobile: billingContact.phone_mobile || null,
              is_main_user: false,
              role: 'user',
              can_add_vehicles: billingContact.can_add_vehicles,
              can_edit_vehicles: billingContact.can_edit_vehicles,
              can_delete_vehicles: billingContact.can_delete_vehicles,
              can_add_drivers: billingContact.can_add_drivers,
              can_edit_drivers: billingContact.can_edit_drivers,
              can_delete_drivers: billingContact.can_delete_drivers,
              can_view_reports: billingContact.can_view_reports,
              can_edit_organization_info: billingContact.can_edit_organization_info,
              can_view_fuel_transactions: billingContact.can_view_fuel_transactions,
              can_create_reports: billingContact.can_create_reports,
              can_view_custom_reports: billingContact.can_view_custom_reports,
              can_manage_users: billingContact.can_manage_users,
              can_view_financial_data: billingContact.can_view_financial_data,
            }],
          }),
        });

        if (!billingResponse.ok) {
          const errorData = await billingResponse.json();
          throw new Error(errorData.error || 'Failed to create billing user');
        }
      }

      if (isSameUser) {
        setSuccess('Client organization and main user created successfully!');
      } else {
        setSuccess('Client organization, main user, and billing user created successfully!');
      }
      setTimeout(() => {
        if (onNavigate) {
          onNavigate('client-organizations-menu');
        }
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Wrap entire render in try-catch
  try {
    // Step 1: Account Type Selection
    if (step === 'type-selection') {
      return (
        <div className="h-full flex flex-col">
          <div className="sticky top-0 bg-white z-10 border-b border-gray-200 px-6 py-4 flex-shrink-0">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">Create New Client</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('client-organizations-menu')}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Select Account Type</h3>
                <p className="text-sm text-gray-600">Choose whether this is an organization or individual account</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  onClick={() => {
                    setAccountType('organization');
                    setStep('details');
                  }}
                  className="p-6 border-2 border-gray-300 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                      <Building2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Organization</h4>
                    <p className="text-sm text-gray-600">
                      For companies, businesses, or entities with registration numbers and VAT
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setAccountType('individual');
                    setStep('details');
                  }}
                  className="p-6 border-2 border-gray-300 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                      <Building2 className="w-8 h-8 text-blue-600" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Individual</h4>
                    <p className="text-sm text-gray-600">
                      For personal accounts using an ID number instead of company registration
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Step 2: Organization Details Form
    return (
      <div className="h-full flex flex-col">
      <div className="sticky top-0 bg-white z-10 border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Create New Client - {accountType === 'organization' ? 'Organization' : 'Individual'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setStep('type-selection');
                setAccountType(null);
              }}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('client-organizations-menu')}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-client-form"
              disabled={loading}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
        {componentError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-800 font-semibold mb-1">Access Denied</h3>
                <p className="text-red-700 text-sm">{componentError}</p>
                <button
                  onClick={() => onNavigate && onNavigate('client-organizations-menu')}
                  className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-red-800 text-xs">{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-2.5 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-green-800 text-xs">{success}</div>
          </div>
        )}

        {!componentError && (
        <form id="create-client-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            {accountType === 'organization' ? 'Organization Details' : 'Individual Details'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                {accountType === 'organization' ? 'Organization Name' : 'Account Name'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => safeSetFormData({ ...formData, name: e.target.value.toUpperCase().trim() })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                placeholder={accountType === 'organization' ? 'e.g., ACME TRANSPORT LTD' : 'e.g., JOHN SMITH'}
              />
            </div>
            {accountType === 'organization' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    value={formData.company_registration_number}
                    onChange={(e) => safeSetFormData({ ...formData, company_registration_number: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">VAT Number</label>
                  <input
                    type="text"
                    value={formData.vat_number}
                    onChange={(e) => safeSetFormData({ ...formData, vat_number: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Website</label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => safeSetFormData({ ...formData, website: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  ID Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.company_registration_number}
                  onChange={(e) => safeSetFormData({ ...formData, company_registration_number: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., 8001015009087"
                  maxLength={13}
                />
              </div>
            )}
          </div>
        </div>

        <div className="border-t pt-3">
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            {accountType === 'organization' ? 'Organization Address' : 'Residential Address'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Address Line 1</label>
              <input
                type="text"
                value={formData.address_line_1}
                onChange={(e) => safeSetFormData({ ...formData, address_line_1: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Address Line 2</label>
              <input
                type="text"
                value={formData.address_line_2}
                onChange={(e) => safeSetFormData({ ...formData, address_line_2: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => safeSetFormData({ ...formData, city: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Province</label>
              <select
                value={formData.province}
                onChange={(e) => safeSetFormData({ ...formData, province: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">-- Select Province --</option>
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
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Postal Code</label>
              <input
                type="text"
                value={formData.postal_code}
                onChange={(e) => safeSetFormData({ ...formData, postal_code: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => safeSetFormData({ ...formData, country: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-3">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Payment Configuration</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Fuel Payment Option <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.payment_option || ''}
                onChange={(e) => safeSetFormData({
                  ...formData,
                  payment_option: e.target.value || null as any,
                  fuel_payment_terms: null,
                  fuel_payment_interest_rate: null,
                })}
                className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  !formData.payment_option ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              >
                <option value="">-- Select Payment Option --</option>
                <option value="Card Payment">Credit/Debit Card Payment</option>
                <option value="Local Account">Local Account</option>
              </select>
            </div>

            {formData.payment_option === 'Card Payment' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-900 font-medium">
                  Client's credit/debit card is securely encrypted and stored. Drivers use their PIN + NFC to transfer card details to garage card machines for payment. Client pays garages directly via their card and only pays MyFuelApp for management fees.
                </p>
                <p className="text-xs text-blue-800 mt-2">
                  Note: Card will be configured after organization creation in Financial Info section.
                </p>
              </div>
            )}

            {formData.payment_option === 'Local Account' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-900 font-medium">
                  Client has existing local accounts with garages. MyFuelApp manages fuel transactions and billing. Client pays MyFuelApp for management fees only. Fuel costs are settled through existing local account arrangements.
                </p>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-gray-900 mb-2">Payment Option Guide:</h4>
              <div className="space-y-1.5 text-xs text-gray-700">
                <div>
                  <span className="font-medium text-blue-700">Credit/Debit Card Payment:</span> Client's card stored securely. Drivers use PIN + NFC for payments at garages. Client pays garages directly and MyFuelApp for management fees only.
                </div>
                <div>
                  <span className="font-medium text-amber-700">Local Account:</span> Client has existing accounts with garages. MyFuelApp tracks transactions. Client pays MyFuelApp for management fees only. Best for established garage relationships.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-3">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Main User & Contact Person</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={mainUser.name}
                onChange={(e) => safeSetMainUser({ ...mainUser, name: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Surname <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={mainUser.surname}
                onChange={(e) => safeSetMainUser({ ...mainUser, surname: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={mainUser.email}
                onChange={(e) => safeSetMainUser({ ...mainUser, email: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                value={mainUser.password}
                onChange={(e) => safeSetMainUser({ ...mainUser, password: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Office Number</label>
              <input
                type="text"
                value={mainUser.phone_office}
                onChange={(e) => safeSetMainUser({ ...mainUser, phone_office: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Mobile Number</label>
              <input
                type="text"
                value={mainUser.phone_mobile}
                onChange={(e) => safeSetMainUser({ ...mainUser, phone_mobile: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900 font-medium">
                Main User Access: This user will automatically have full access to all features, including managing vehicles, drivers, viewing fuel transactions, creating reports, and managing other users.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold text-gray-900">Billing User</h3>
            <button
              type="button"
              onClick={copyMainUserToBilling}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Same as Main User
            </button>
          </div>
          <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-900">
              You can use the same person for Main User and Billing User. If you enter the same email address, only one user will be created with full access permissions.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={billingContact.name}
                onChange={(e) => {
                  console.log('[CreateClient] Billing name changed');
                  safeSetBillingContact({ ...billingContact, name: e.target.value });
                }}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Surname <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={billingContact.surname}
                onChange={(e) => {
                  console.log('[CreateClient] Billing surname changed');
                  safeSetBillingContact({ ...billingContact, surname: e.target.value });
                }}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={billingContact.email}
                onChange={(e) => {
                  console.log('[CreateClient] Billing email changed');
                  safeSetBillingContact({ ...billingContact, email: e.target.value });
                }}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                value={billingContact.password}
                onChange={(e) => {
                  console.log('[CreateClient] Billing password changed');
                  safeSetBillingContact({ ...billingContact, password: e.target.value });
                }}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Office Number</label>
              <input
                type="text"
                value={billingContact.phone_office}
                onChange={(e) => {
                  console.log('[CreateClient] Billing office phone changed');
                  safeSetBillingContact({ ...billingContact, phone_office: e.target.value });
                }}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Mobile Number</label>
              <input
                type="text"
                value={billingContact.phone_mobile}
                onChange={(e) => {
                  try {
                    console.log('[CreateClient] Billing mobile number changed:', e.target.value);
                    safeSetBillingContact({ ...billingContact, phone_mobile: e.target.value });
                  } catch (err: any) {
                    console.error('[CreateClient] Error in billing mobile onChange:', err);
                    setError('Error updating mobile number');
                  }
                }}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-2">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Permissions</h4>

              <div className="space-y-3">
                <div className="border border-gray-200 rounded-lg p-3">
                  <h5 className="text-xs font-semibold text-gray-800 mb-2">Organization Management</h5>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingContact.can_edit_organization_info}
                        onChange={(e) => {
                          console.log('[CreateClient] Permission changed: can_edit_organization_info');
                          safeSetBillingContact({ ...billingContact, can_edit_organization_info: e.target.checked });
                        }}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">Can Edit Organization Info</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingContact.can_manage_users}
                        onChange={(e) => {
                          console.log('[CreateClient] Permission changed: can_manage_users');
                          safeSetBillingContact({ ...billingContact, can_manage_users: e.target.checked });
                        }}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">Can Manage Users</span>
                    </label>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-3">
                  <h5 className="text-xs font-semibold text-gray-800 mb-2">Vehicle Management</h5>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingContact.can_add_vehicles}
                        onChange={(e) => safeSetBillingContact({ ...billingContact, can_add_vehicles: e.target.checked })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">Can Add Vehicles</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingContact.can_edit_vehicles}
                        onChange={(e) => safeSetBillingContact({ ...billingContact, can_edit_vehicles: e.target.checked })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">Can Edit Vehicles</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingContact.can_delete_vehicles}
                        onChange={(e) => safeSetBillingContact({ ...billingContact, can_delete_vehicles: e.target.checked })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">Can Delete Vehicles</span>
                    </label>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-3">
                  <h5 className="text-xs font-semibold text-gray-800 mb-2">Driver Management</h5>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingContact.can_add_drivers}
                        onChange={(e) => safeSetBillingContact({ ...billingContact, can_add_drivers: e.target.checked })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">Can Add Drivers</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingContact.can_edit_drivers}
                        onChange={(e) => safeSetBillingContact({ ...billingContact, can_edit_drivers: e.target.checked })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">Can Edit Drivers</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingContact.can_delete_drivers}
                        onChange={(e) => safeSetBillingContact({ ...billingContact, can_delete_drivers: e.target.checked })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">Can Delete Drivers</span>
                    </label>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-3">
                  <h5 className="text-xs font-semibold text-gray-800 mb-2">Fuel Transactions</h5>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingContact.can_view_fuel_transactions}
                        onChange={(e) => safeSetBillingContact({ ...billingContact, can_view_fuel_transactions: e.target.checked })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">Can View Fuel Transactions</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 italic">Note: Fuel transactions are created only by drivers via the mobile app and cannot be edited or deleted by anyone to maintain data integrity</p>
                </div>

                <div className="border border-gray-200 rounded-lg p-3">
                  <h5 className="text-xs font-semibold text-gray-800 mb-2">Reports & Data</h5>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingContact.can_view_reports}
                        onChange={(e) => safeSetBillingContact({ ...billingContact, can_view_reports: e.target.checked })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">Can View Reports</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingContact.can_create_reports}
                        onChange={(e) => safeSetBillingContact({ ...billingContact, can_create_reports: e.target.checked })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">Can Create Reports</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingContact.can_view_custom_reports}
                        onChange={(e) => safeSetBillingContact({ ...billingContact, can_view_custom_reports: e.target.checked })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">Can View Custom Reports</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingContact.can_view_financial_data}
                        onChange={(e) => safeSetBillingContact({ ...billingContact, can_view_financial_data: e.target.checked })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">Can View Financial Data</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-3">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Financial Settings</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Monthly Fee Per Vehicle (R)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.monthly_fee_per_vehicle}
                onFocus={(e) => e.target.select()}
                onChange={(e) => safeSetFormData({ ...formData, monthly_fee_per_vehicle: parseFloat(e.target.value) })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Daily Spending Limit (R)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="No limit"
                value={formData.daily_spending_limit ?? ''}
                onChange={(e) => safeSetFormData({ ...formData, daily_spending_limit: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Monthly Spending Limit (R)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="No limit"
                value={formData.monthly_spending_limit ?? ''}
                onChange={(e) => safeSetFormData({ ...formData, monthly_spending_limit: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Month End Day (1-31)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.month_end_day}
                onFocus={(e) => e.target.select()}
                onChange={(e) => safeSetFormData({ ...formData, month_end_day: parseInt(e.target.value) })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Year End Month</label>
              <select
                value={formData.year_end_month}
                onChange={(e) => safeSetFormData({ ...formData, year_end_month: parseInt(e.target.value) })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
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
                Year End Day (1-31)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.year_end_day}
                onFocus={(e) => e.target.select()}
                onChange={(e) => safeSetFormData({ ...formData, year_end_day: parseInt(e.target.value) })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
        </form>
        )}
        </div>
      </div>
    </div>
    );
  } catch (renderError: any) {
    console.error('[CreateClient] Render error:', renderError);
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-md bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="text-red-800 font-semibold mb-2">Component Error</h3>
              <p className="text-red-700 text-sm mb-4">
                An unexpected error occurred while rendering this page: {renderError.message}
              </p>
              <button
                onClick={() => {
                  console.log('[CreateClient] Navigating back after render error');
                  if (onNavigate) onNavigate('client-organizations-menu');
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
