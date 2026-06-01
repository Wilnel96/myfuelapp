import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import GarageClientIntakeForm, { IntakeFormType } from './GarageClientIntakeForm';
import { Building2, Save, AlertCircle, CheckCircle, Copy, Printer, User, CreditCard } from 'lucide-react';

interface CreateClientOrganizationProps {
  onNavigate?: (view: string) => void;
  /** When true: no login required, calls the public client-self-signup edge function */
  publicMode?: boolean;
  /** When set, pre-locks the payment option to this value and hides the selector */
  lockedPaymentOption?: 'Card Payment' | 'Local Account';
  /** When set, the new organization is linked to this garage as a managed client */
  managingGarageId?: string | null;
}

export default function CreateClientOrganization({ onNavigate, publicMode = false, lockedPaymentOption, managingGarageId }: CreateClientOrganizationProps) {
  const [step, setStep] = useState<'type-selection' | 'details'>('type-selection');
  const [accountType, setAccountType] = useState<'organization' | 'individual' | null>(null);
  const [individualPaymentType, setIndividualPaymentType] = useState<'local-account' | 'card-payment' | null>(null);
  const [organizationPaymentType, setOrganizationPaymentType] = useState<'local-account' | 'card-payment' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [componentError, setComponentError] = useState<string | null>(null);
  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [intakeFormType, setIntakeFormType] = useState<IntakeFormType>('organisation');

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

  const [individualName, setIndividualName] = useState('');
  const [individualSurname, setIndividualSurname] = useState('');
  const [mainUserIsIndividual, setMainUserIsIndividual] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [garageAccountNumber, setGarageAccountNumber] = useState('');
  const [debitOrderAuthorised, setDebitOrderAuthorised] = useState(false);
  const [bankDetails, setBankDetails] = useState({
    company_name: 'Fuel Empowerment Systems (Pty) Ltd',
    bank_name: '',
    bank_account_holder: '',
    bank_account_number: '',
    bank_branch_code: '',
    bank_account_type: '',
  });

  // Client's own bank details (for debit order collection of management fees)
  const [clientBankDetails, setClientBankDetails] = useState({
    bank_name: '',
    bank_account_holder: '',
    bank_account_number: '',
    bank_branch_code: '',
    bank_account_type: '',
  });

  const [formData, setFormData] = useState({
    name: '',
    entity_type: '',
    entity_type_other: '',
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
    monthly_fee_per_driver: 0,
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
    const init = async () => {
      try {
        if (!publicMode) {
          // Admin mode: verify caller is from the management org
          console.log('[CreateClient] Checking permissions...');
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) { setComponentError('Not authenticated'); return; }

          const { data: profile } = await supabase
            .from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
          if (!profile?.organization_id) { setComponentError('No organization found'); return; }

          const { data: parentOrg } = await supabase
            .from('organizations').select('id, name').eq('id', profile.organization_id).maybeSingle();
          if (!parentOrg) { setComponentError('Parent organization not found'); return; }
          if (parentOrg.name !== 'FUEL EMPOWERMENT SYSTEMS (PTY) LTD') {
            setComponentError('Only management organization can create client organizations');
            return;
          }
        }

        // Load global default monthly fees and bank details (works anonymously)
        const bankKeys = ['monthly_fee_per_vehicle', 'monthly_fee_per_driver', 'company_name', 'bank_name', 'bank_account_holder', 'bank_account_number', 'bank_branch_code', 'bank_account_type'];
        const { data: settingsRows } = await supabase
          .from('global_settings')
          .select('key, value')
          .in('key', bankKeys);

        const settings: Record<string, string> = {};
        (settingsRows ?? []).forEach((r: any) => { settings[r.key] = r.value; });

        safeSetFormData((prev: any) => {
          const updates: any = {};
          if (settings.monthly_fee_per_vehicle) {
            const v = parseFloat(settings.monthly_fee_per_vehicle);
            if (!isNaN(v)) updates.monthly_fee_per_vehicle = v;
          }
          if (settings.monthly_fee_per_driver) {
            const d = parseFloat(settings.monthly_fee_per_driver);
            if (!isNaN(d)) updates.monthly_fee_per_driver = d;
          }
          if (lockedPaymentOption) {
            updates.payment_option = lockedPaymentOption;
          }
          return { ...prev, ...updates };
        });

        setBankDetails({
          company_name: settings.company_name || 'Fuel Empowerment Systems (Pty) Ltd',
          bank_name: settings.bank_name || '',
          bank_account_holder: settings.bank_account_holder || '',
          bank_account_number: settings.bank_account_number || '',
          bank_branch_code: settings.bank_branch_code || '',
          bank_account_type: settings.bank_account_type || '',
        });

        console.log('[CreateClient] Init complete');
      } catch (err: any) {
        console.error('[CreateClient] Init error:', err);
        setComponentError(err.message || 'Failed to initialise');
      }
    };

    init();
  }, [publicMode]);

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

  const buildOrgAndUsers = () => {
    // Build org name
    const orgName = accountType === 'individual'
      ? `${individualName.trim()} ${individualSurname.trim()}`.trim().toUpperCase()
      : formData.name.toUpperCase().trim();

    const organization = {
      ...formData,
      name: orgName,
      monthly_fee_per_driver: formData.monthly_fee_per_driver,
      entity_type: accountType === 'individual' ? 'Individual' : (formData.entity_type || null),
      entity_type_other: (accountType === 'organization' && formData.entity_type === 'Other') ? formData.entity_type_other.trim() || null : null,
      payment_option: (publicMode && accountType === 'individual')
        ? (individualPaymentType === 'local-account' ? 'Local Account' : 'Card Payment')
        : (formData.payment_option || null),
      fuel_payment_terms: formData.fuel_payment_terms || null,
      fuel_payment_interest_rate: formData.fuel_payment_interest_rate || null,
      daily_spending_limit: formData.daily_spending_limit || null,
      monthly_spending_limit: formData.monthly_spending_limit || null,
      website: formData.website || null,
      address_line_2: formData.address_line_2 || null,
      organization_type: 'client',
      is_management_org: false,
      status: 'active',
      managing_garage_id: managingGarageId || null,
      is_garage_managed: !!managingGarageId,
      // Client's own bank details for debit order (individuals only)
      ...(accountType === 'individual' ? {
        bank_name: clientBankDetails.bank_name || null,
        bank_account_holder: clientBankDetails.bank_account_holder || null,
        bank_account_number: clientBankDetails.bank_account_number || null,
        bank_branch_code: clientBankDetails.bank_branch_code || null,
        bank_account_type: clientBankDetails.bank_account_type || null,
      } : {}),
    };

    const isSameUser = mainUser.email.toLowerCase().trim() === billingContact.email.toLowerCase().trim();

    const mainUserPayload = {
      email: mainUser.email,
      password: mainUser.password,
      name: mainUser.name,
      surname: mainUser.surname,
      phone_office: mainUser.phone_office || null,
      phone_mobile: mainUser.phone_mobile || null,
      is_main_user: true,
      role: 'admin',
    };

    const users = isSameUser ? [mainUserPayload] : [
      mainUserPayload,
      {
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
      },
    ];

    return { organization, users, isSameUser };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validate account type specific fields
      if (accountType === 'individual') {
        const fullName = `${individualName.trim()} ${individualSurname.trim()}`.trim();
        if (!fullName) throw new Error('Name and Surname are required');
        // Bank details only required for card payment individuals (used for debit order)
        if (individualPaymentType !== 'local-account') {
          if (!clientBankDetails.bank_name) throw new Error('Please select a bank for the debit order');
          if (!clientBankDetails.bank_account_holder.trim()) throw new Error('Account holder name is required');
          if (!clientBankDetails.bank_account_number.trim()) throw new Error('Account number is required');
          if (!clientBankDetails.bank_branch_code.trim()) throw new Error('Branch code is required');
          if (!clientBankDetails.bank_account_type) throw new Error('Please select an account type');
        }
        // For public local-account individuals, validate confirm password
        if (publicMode && individualPaymentType === 'local-account') {
          if (!mainUser.email.trim()) throw new Error('Email address is required');
          if (!mainUser.password) throw new Error('Password is required');
          if (mainUser.password !== confirmPassword) throw new Error('Passwords do not match');
        }
        if (publicMode && individualPaymentType === 'card-payment') {
          if (!mainUser.email.trim()) throw new Error('Email address is required');
          if (!mainUser.password) throw new Error('Password is required');
          if (mainUser.password.length < 6) throw new Error('Password must be at least 6 characters');
          if (mainUser.password !== confirmPassword) throw new Error('Passwords do not match');
        }
      }
      if (accountType === 'organization') {
        if (!formData.entity_type) throw new Error('Please select an entity type');
        if (formData.entity_type === 'Other' && !formData.entity_type_other.trim()) {
          throw new Error('Please describe the entity type');
        }
      }

      // Require debit order authorisation in public signup for card payment accounts (not local-account individuals)
      const isLocalAccountIndividual = accountType === 'individual' && individualPaymentType === 'local-account';
      if (publicMode && !isLocalAccountIndividual && (formData.payment_option === 'Card Payment' || accountType === 'individual')) {
        if (!debitOrderAuthorised) {
          throw new Error('Please authorise the debit order for monthly management fees before continuing.');
        }
      }

      const { organization, users, isSameUser } = buildOrgAndUsers();

      if (publicMode) {
        // Public self-signup: call the public edge function (no auth token needed)
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-self-signup`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization,
            users,
            garage_account_number: managingGarageId ? (garageAccountNumber.trim() || null) : undefined,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Signup failed');
      } else {
        // Admin mode: requires session + super_admin role
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
          .from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
        if (!profile?.organization_id) throw new Error('No organization found');

        const { data: parentOrg } = await supabase
          .from('organizations').select('id, name').eq('id', profile.organization_id).maybeSingle();
        if (!parentOrg) throw new Error('Parent organization not found');
        if (parentOrg.name !== 'FUEL EMPOWERMENT SYSTEMS (PTY) LTD') {
          throw new Error('Only management organization can create client organizations');
        }

        // Check duplicate org name
        const { data: existingOrg } = await supabase
          .from('organizations').select('id').eq('name', organization.name).maybeSingle();
        if (existingOrg) {
          throw new Error(`An organization with the name "${organization.name}" already exists. Please use a different name.`);
        }

        const { data: newOrg, error: insertError } = await supabase
          .from('organizations').insert(organization).select().single();
        if (insertError) {
          if (insertError.code === '23505') throw new Error(`An organization with that name already exists.`);
          throw insertError;
        }
        if (!newOrg) throw new Error('Failed to create organization');

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session found');

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-organization-users`;
        for (const userBatch of isSameUser ? [users] : [[users[0]], [users[1]]]) {
          const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ organization_id: newOrg.id, users: userBatch }),
          });
          if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.error || 'Failed to create user');
          }
        }
      }

      setSuccess(
        isSameUser
          ? 'Account created successfully!'
          : 'Account created successfully with main user and billing user!'
      );

      setTimeout(() => {
        if (publicMode) {
          // Return to main menu after public signup
          if (onNavigate) onNavigate('back-to-home');
        } else {
          if (onNavigate) onNavigate('client-organizations-menu');
        }
      }, 2500);
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
        <>
        <div className="h-full flex flex-col">
          <div className="sticky top-0 bg-white z-10 border-b border-gray-200 px-6 py-4 flex-shrink-0">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {publicMode ? 'New Client Signup' : 'Create New Client'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate(publicMode ? 'back-to-home' : 'client-organizations-menu')}
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
                {/* Organisation card */}
                <div className="flex flex-col gap-3">
                  {publicMode ? (
                    <>
                      <div className="text-center">
                        <h4 className="text-base font-semibold text-gray-900 mb-1">Organization</h4>
                        <p className="text-xs text-gray-500 mb-3">Select how the organization will pay for fuel</p>
                      </div>
                      <button
                        onClick={() => {
                          setAccountType('organization');
                          setOrganizationPaymentType('local-account');
                          setStep('details');
                        }}
                        className="p-4 border-2 border-gray-300 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition-all group text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-teal-200 transition-colors">
                            <Building2 className="w-5 h-5 text-teal-600" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">Organization — Local Garage Account</div>
                            <div className="text-xs text-gray-500 mt-0.5">Garage manages the account. Organization pays via a local fuel account.</div>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setAccountType('organization');
                          setOrganizationPaymentType('card-payment');
                          setStep('details');
                        }}
                        className="p-4 border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                            <CreditCard className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">Organization — Pay by Card</div>
                            <div className="text-xs text-gray-500 mt-0.5">Organization signs up directly. Drivers pay via Credit/Debit Card using PIN + NFC.</div>
                          </div>
                        </div>
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setIntakeFormType('organisation'); setShowIntakeForm(true); }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                          Print Local Account Form
                        </button>
                        <button
                          onClick={() => { setIntakeFormType('organisation-card'); setShowIntakeForm(true); }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                          Print Card Payment Form
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setAccountType('organization');
                          setStep('details');
                        }}
                        className="flex-1 p-6 border-2 border-gray-300 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setIntakeFormType('organisation'); setShowIntakeForm(true); }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                          Print Local Account Form
                        </button>
                        <button
                          onClick={() => { setIntakeFormType('organisation-card'); setShowIntakeForm(true); }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                          Print Card Payment Form
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Individual — splits into two sub-options in both public and admin mode */}
                {publicMode ? (
                  <div className="flex flex-col gap-3">
                    <div className="text-center">
                      <h4 className="text-base font-semibold text-gray-900 mb-1">Individual</h4>
                      <p className="text-xs text-gray-500 mb-3">Select how the individual will pay for fuel</p>
                    </div>
                    <button
                      onClick={() => {
                        setAccountType('individual');
                        setIndividualPaymentType('local-account');
                        setStep('details');
                      }}
                      className="p-4 border-2 border-gray-300 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition-all group text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-teal-200 transition-colors">
                          <Building2 className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">Individual — Local Account</div>
                          <div className="text-xs text-gray-500 mt-0.5">Register with a garage. The garage sets up your account number, deposit and spending limit.</div>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setAccountType('individual');
                        setIndividualPaymentType('card-payment');
                        setStep('details');
                      }}
                      className="p-4 border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                          <CreditCard className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">Individual — Card Payment</div>
                          <div className="text-xs text-gray-500 mt-0.5">Pays for fuel directly via Credit/Debit card using PIN + NFC at garages.</div>
                        </div>
                      </div>
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setIntakeFormType('individual'); setShowIntakeForm(true); }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        Print Local Account Form
                      </button>
                      <button
                        onClick={() => { setIntakeFormType('individual-card'); setShowIntakeForm(true); }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        Print Card Payment Form
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="text-center">
                      <h4 className="text-base font-semibold text-gray-900 mb-1">Individual</h4>
                      <p className="text-xs text-gray-500 mb-3">Select how the individual will pay for fuel</p>
                    </div>
                    <button
                      onClick={() => {
                        setAccountType('individual');
                        setIndividualPaymentType('local-account');
                        setStep('details');
                      }}
                      className="p-4 border-2 border-gray-300 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition-all group text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-teal-200 transition-colors">
                          <Building2 className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">Individual — Local Account</div>
                          <div className="text-xs text-gray-500 mt-0.5">Garage manages the account. Client pays via a local fuel account at this garage.</div>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setAccountType('individual');
                        setIndividualPaymentType('card-payment');
                        setStep('details');
                      }}
                      className="p-4 border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                          <CreditCard className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">Individual — Card Payment</div>
                          <div className="text-xs text-gray-500 mt-0.5">Client pays for fuel directly via their Credit/Debit card using PIN + NFC at garages.</div>
                        </div>
                      </div>
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setIntakeFormType('individual'); setShowIntakeForm(true); }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        Print Local Account Form
                      </button>
                      <button
                        onClick={() => { setIntakeFormType('individual-card'); setShowIntakeForm(true); }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        Print Card Payment Form
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {showIntakeForm && (
          <GarageClientIntakeForm
            formType={intakeFormType}
            onClose={() => setShowIntakeForm(false)}
          />
        )}
        </>
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
              {publicMode ? 'New Client Signup' : 'Create New Client'} —{' '}
              {accountType === 'organization'
                ? (organizationPaymentType === 'card-payment' ? 'Organization (Card Payment)' : organizationPaymentType === 'local-account' ? 'Organization (Local Account)' : 'Organization')
                : individualPaymentType === 'card-payment' ? 'Individual (Card Payment)' : 'Individual (Local Account)'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setStep('type-selection');
                setAccountType(null);
                setIndividualPaymentType(null);
                setOrganizationPaymentType(null);
              }}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate(publicMode ? 'back-to-home' : 'client-organizations-menu')}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
            >
              Cancel
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
                  onClick={() => onNavigate && onNavigate(publicMode ? 'back-to-home' : 'client-organizations-menu')}
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
        {/* INDIVIDUAL — CARD PAYMENT */}
        {accountType === 'individual' && individualPaymentType === 'card-payment' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-900">
              <strong>Instructions:</strong> Complete all fields marked <span className="text-red-600 font-bold">*</span>. Use block letters.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Personal Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Name <span className="text-red-500">*</span></label>
                <input type="text" required value={individualName}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setIndividualName(val);
                    safeSetMainUser((prev: any) => ({ ...prev, name: val }));
                    setClientBankDetails((prev: any) => ({ ...prev, bank_account_holder: `${val} ${individualSurname}`.trim() }));
                  }}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                  placeholder="E.G., JOHN"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Surname <span className="text-red-500">*</span></label>
                <input type="text" required value={individualSurname}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setIndividualSurname(val);
                    safeSetMainUser((prev: any) => ({ ...prev, surname: val }));
                    setClientBankDetails((prev: any) => ({ ...prev, bank_account_holder: `${individualName} ${val}`.trim() }));
                  }}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                  placeholder="E.G., SMITH"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">SA ID Number <span className="text-red-500">*</span></label>
                <input type="text" required maxLength={13} value={formData.company_registration_number}
                  onChange={(e) => safeSetFormData({ ...formData, company_registration_number: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., 8001015009087"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Mobile Number</label>
                <input type="text" value={mainUser.phone_mobile}
                  onChange={(e) => safeSetMainUser({ ...mainUser, phone_mobile: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Office Number</label>
                <input type="text" value={mainUser.phone_office}
                  onChange={(e) => safeSetMainUser({ ...mainUser, phone_office: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          <div className="border-t pt-3">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Address</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Address Line 1</label>
                <input type="text" value={formData.address_line_1}
                  onChange={(e) => safeSetFormData({ ...formData, address_line_1: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Address Line 2</label>
                <input type="text" value={formData.address_line_2}
                  onChange={(e) => safeSetFormData({ ...formData, address_line_2: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">City</label>
                <input type="text" value={formData.city}
                  onChange={(e) => safeSetFormData({ ...formData, city: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Province</label>
                <select value={formData.province} onChange={(e) => safeSetFormData({ ...formData, province: e.target.value })}
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
                <input type="text" value={formData.postal_code}
                  onChange={(e) => safeSetFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Country</label>
                <input type="text" value={formData.country}
                  onChange={(e) => safeSetFormData({ ...formData, country: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          <div className="border-t pt-3">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Login Details</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-blue-900 font-medium mb-1">You are the Main User and Billing User by default.</p>
              <p className="text-xs text-blue-800">
                These roles can be changed after signup by logging in to the <strong>Client Portal</strong> and selecting <strong>Client User Management</strong>. You can assign a different Main User or Billing User at any time.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Email Address <span className="text-red-500">*</span></label>
                <input type="email" required value={mainUser.email}
                  onChange={(e) => safeSetMainUser({ ...mainUser, email: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Used to sign in to the Client Portal"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Password <span className="text-red-500">*</span></label>
                <input type="password" required value={mainUser.password}
                  onChange={(e) => safeSetMainUser({ ...mainUser, password: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Minimum 6 characters"
                />
              </div>
              {publicMode && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Confirm Password <span className="text-red-500">*</span></label>
                <input type="password" required value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${confirmPassword && confirmPassword !== mainUser.password ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  placeholder="Re-enter password"
                />
                {confirmPassword && confirmPassword !== mainUser.password && (
                  <p className="text-xs text-red-600 mt-0.5">Passwords do not match</p>
                )}
              </div>
              )}
            </div>
          </div>
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-base font-semibold text-gray-900">Bank Account Details</h3>
              <span className="text-xs text-red-500 font-medium">Required for debit order</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3">
              <p className="text-xs text-amber-900">
                Monthly vehicle and driver management fees are collected via debit order. The account holder name has been pre-filled from your name above — edit if different.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Bank <span className="text-red-500">*</span></label>
                <select value={clientBankDetails.bank_name}
                  onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_name: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">-- Select Bank --</option>
                  <option value="Absa">Absa</option>
                  <option value="African Bank">African Bank</option>
                  <option value="Capitec">Capitec</option>
                  <option value="Discovery Bank">Discovery Bank</option>
                  <option value="FNB">FNB</option>
                  <option value="Investec">Investec</option>
                  <option value="Nedbank">Nedbank</option>
                  <option value="Standard Bank">Standard Bank</option>
                  <option value="Tyme Bank">Tyme Bank</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Type <span className="text-red-500">*</span></label>
                <select value={clientBankDetails.bank_account_type}
                  onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_account_type: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">-- Select Type --</option>
                  <option value="Current">Current / Cheque</option>
                  <option value="Savings">Savings</option>
                  <option value="Transmission">Transmission</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Holder Name <span className="text-red-500">*</span></label>
                <input type="text" value={clientBankDetails.bank_account_holder}
                  onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_account_holder: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="As it appears on the account"
                />
                <p className="text-xs text-green-600 mt-0.5">Auto-filled from your name — edit if different</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Number <span className="text-red-500">*</span></label>
                <input type="text" value={clientBankDetails.bank_account_number}
                  onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_account_number: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Account number"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Branch Code <span className="text-red-500">*</span></label>
                <input type="text" value={clientBankDetails.bank_branch_code}
                  onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_branch_code: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g. 250655"
                />
              </div>
            </div>
          </div>
        </div>
        )}

        {/* INDIVIDUAL — LOCAL ACCOUNT (Public self-signup) */}
        {publicMode && accountType === 'individual' && individualPaymentType === 'local-account' && (
        <div className="space-y-4">
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
            <p className="text-xs text-teal-900">
              <strong>Garage Local Account:</strong> Complete your personal details below and create a login. The garage will set up your account number, deposit required, and spending limit.
            </p>
          </div>

          {/* Personal Details */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Personal Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Name <span className="text-red-500">*</span></label>
                <input type="text" required value={individualName}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setIndividualName(val);
                    safeSetMainUser((prev: any) => ({ ...prev, name: val }));
                  }}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent uppercase"
                  placeholder="E.G., JOHN"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Surname <span className="text-red-500">*</span></label>
                <input type="text" required value={individualSurname}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setIndividualSurname(val);
                    safeSetMainUser((prev: any) => ({ ...prev, surname: val }));
                  }}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent uppercase"
                  placeholder="E.G., SMITH"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-0.5">SA ID Number</label>
                <input type="text" maxLength={13} value={formData.company_registration_number}
                  onChange={(e) => safeSetFormData({ ...formData, company_registration_number: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="e.g., 8001015009087"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Mobile Number</label>
                <input type="text" value={mainUser.phone_mobile}
                  onChange={(e) => safeSetMainUser({ ...mainUser, phone_mobile: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="e.g., 082 555 1234"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Office / Other Number</label>
                <input type="text" value={mainUser.phone_office}
                  onChange={(e) => safeSetMainUser({ ...mainUser, phone_office: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="e.g., 021 555 1234"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="border-t pt-3">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Address</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Address Line 1</label>
                <input type="text" value={formData.address_line_1}
                  onChange={(e) => safeSetFormData({ ...formData, address_line_1: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Address Line 2</label>
                <input type="text" value={formData.address_line_2}
                  onChange={(e) => safeSetFormData({ ...formData, address_line_2: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">City</label>
                <input type="text" value={formData.city}
                  onChange={(e) => safeSetFormData({ ...formData, city: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Province</label>
                <select value={formData.province} onChange={(e) => safeSetFormData({ ...formData, province: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                <input type="text" value={formData.postal_code}
                  onChange={(e) => safeSetFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Country</label>
                <input type="text" value={formData.country}
                  onChange={(e) => safeSetFormData({ ...formData, country: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Login Details */}
          <div className="border-t pt-3">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Login Details</h3>
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-2.5 mb-3">
              <p className="text-xs text-teal-900">Create your account login. You will use these credentials to access the MyFuelApp client portal.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Email Address <span className="text-red-500">*</span></label>
                <input type="email" required value={mainUser.email}
                  onChange={(e) => safeSetMainUser({ ...mainUser, email: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Password <span className="text-red-500">*</span></label>
                <input type="password" required value={mainUser.password}
                  onChange={(e) => safeSetMainUser({ ...mainUser, password: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Confirm Password <span className="text-red-500">*</span></label>
                <input type="password" required value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent ${confirmPassword && confirmPassword !== mainUser.password ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  placeholder="Re-enter password"
                />
                {confirmPassword && confirmPassword !== mainUser.password && (
                  <p className="text-xs text-red-600 mt-0.5">Passwords do not match</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-900">
              <strong>Next step:</strong> After registering, present yourself at the garage. They will assign your account number, set the deposit required, and configure your spending limit.
            </p>
          </div>
        </div>
        )}

        {/* INDIVIDUAL — LOCAL ACCOUNT (Admin mode) */}
        {!publicMode && accountType === 'individual' && individualPaymentType === 'local-account' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-900">
              <strong>Instructions:</strong> Complete all fields marked <span className="text-red-600 font-bold">*</span>. Use block letters. Return this form to the garage to have your personal fuel account set up.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Personal Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Name <span className="text-red-500">*</span></label>
                <input type="text" required value={individualName}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setIndividualName(val);
                    if (mainUserIsIndividual) {
                      safeSetMainUser((prev: any) => ({ ...prev, name: val }));
                      setClientBankDetails((prev: any) => ({ ...prev, bank_account_holder: `${val} ${individualSurname}`.trim() }));
                    }
                  }}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                  placeholder="E.G., JOHN"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Surname <span className="text-red-500">*</span></label>
                <input type="text" required value={individualSurname}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setIndividualSurname(val);
                    if (mainUserIsIndividual) {
                      safeSetMainUser((prev: any) => ({ ...prev, surname: val }));
                      setClientBankDetails((prev: any) => ({ ...prev, bank_account_holder: `${individualName} ${val}`.trim() }));
                    }
                  }}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                  placeholder="E.G., SMITH"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-0.5">SA ID Number <span className="text-red-500">*</span></label>
                <input type="text" required maxLength={13} value={formData.company_registration_number}
                  onChange={(e) => safeSetFormData({ ...formData, company_registration_number: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., 8001015009087"
                />
              </div>
            </div>
          </div>
          <div className="border-t pt-3">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Address</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Address Line 1</label>
                <input type="text" value={formData.address_line_1}
                  onChange={(e) => safeSetFormData({ ...formData, address_line_1: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Address Line 2</label>
                <input type="text" value={formData.address_line_2}
                  onChange={(e) => safeSetFormData({ ...formData, address_line_2: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">City</label>
                <input type="text" value={formData.city}
                  onChange={(e) => safeSetFormData({ ...formData, city: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Province</label>
                <select value={formData.province} onChange={(e) => safeSetFormData({ ...formData, province: e.target.value })}
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
                <input type="text" value={formData.postal_code}
                  onChange={(e) => safeSetFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Country</label>
                <input type="text" value={formData.country}
                  onChange={(e) => safeSetFormData({ ...formData, country: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          <div className="border-t pt-3">
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mainUserIsIndividual ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
              <input type="checkbox" checked={mainUserIsIndividual}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setMainUserIsIndividual(checked);
                  if (checked) {
                    safeSetMainUser((prev: any) => ({ ...prev, name: individualName, surname: individualSurname }));
                    setClientBankDetails((prev: any) => ({ ...prev, bank_account_holder: `${individualName} ${individualSurname}`.trim() }));
                  }
                }}
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">I am the Main User / Account Holder</p>
                <p className="text-xs text-gray-500">Tick this if the individual signing up will be the system login and the bank account holder</p>
              </div>
            </label>
          </div>
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-base font-semibold text-gray-900">Main User &amp; Login Details</h3>
              {mainUserIsIndividual && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                  <User className="w-3 h-3" />
                  Linked to Individual
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Name <span className="text-red-500">*</span></label>
                <input type="text" required value={mainUser.name}
                  onChange={(e) => safeSetMainUser({ ...mainUser, name: e.target.value.toUpperCase() })}
                  readOnly={mainUserIsIndividual}
                  className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase ${mainUserIsIndividual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Surname <span className="text-red-500">*</span></label>
                <input type="text" required value={mainUser.surname}
                  onChange={(e) => safeSetMainUser({ ...mainUser, surname: e.target.value.toUpperCase() })}
                  readOnly={mainUserIsIndividual}
                  className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase ${mainUserIsIndividual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Email <span className="text-red-500">*</span></label>
                <input type="email" required value={mainUser.email}
                  onChange={(e) => safeSetMainUser({ ...mainUser, email: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Password <span className="text-red-500">*</span></label>
                <input type="password" required value={mainUser.password}
                  onChange={(e) => safeSetMainUser({ ...mainUser, password: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Office Number</label>
                <input type="text" value={mainUser.phone_office}
                  onChange={(e) => safeSetMainUser({ ...mainUser, phone_office: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Mobile Number</label>
                <input type="text" value={mainUser.phone_mobile}
                  onChange={(e) => safeSetMainUser({ ...mainUser, phone_mobile: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-900 font-medium">
                  The main user has full access to all features including fleet management, fuel transactions, reports, and user administration.
                </p>
              </div>
            </div>
          </div>
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-base font-semibold text-gray-900">Bank Account Details</h3>
              <span className="text-xs text-red-500 font-medium">Required for debit order</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3">
              <p className="text-xs text-amber-900">Monthly vehicle and driver management fees are collected via debit order. Provide the individual's bank account below.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Bank <span className="text-red-500">*</span></label>
                <select value={clientBankDetails.bank_name}
                  onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_name: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">-- Select Bank --</option>
                  <option value="Absa">Absa</option>
                  <option value="African Bank">African Bank</option>
                  <option value="Capitec">Capitec</option>
                  <option value="Discovery Bank">Discovery Bank</option>
                  <option value="FNB">FNB</option>
                  <option value="Investec">Investec</option>
                  <option value="Nedbank">Nedbank</option>
                  <option value="Standard Bank">Standard Bank</option>
                  <option value="Tyme Bank">Tyme Bank</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Type <span className="text-red-500">*</span></label>
                <select value={clientBankDetails.bank_account_type}
                  onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_account_type: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">-- Select Type --</option>
                  <option value="Current">Current / Cheque</option>
                  <option value="Savings">Savings</option>
                  <option value="Transmission">Transmission</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Holder Name <span className="text-red-500">*</span></label>
                <input type="text" value={clientBankDetails.bank_account_holder}
                  onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_account_holder: e.target.value })}
                  readOnly={mainUserIsIndividual}
                  className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${mainUserIsIndividual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}
                  placeholder="As it appears on the account"
                />
                {mainUserIsIndividual && <p className="text-xs text-green-600 mt-0.5">Auto-filled from individual's name</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Number <span className="text-red-500">*</span></label>
                <input type="text" value={clientBankDetails.bank_account_number}
                  onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_account_number: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Account number"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Branch Code <span className="text-red-500">*</span></label>
                <input type="text" value={clientBankDetails.bank_branch_code}
                  onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_branch_code: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g. 250655"
                />
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ORGANIZATION DETAILS */}
        {accountType === 'organization' && (
        <div className="space-y-4">
          {publicMode && organizationPaymentType === 'card-payment' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-green-900">
                <strong>Instructions:</strong> Complete all fields marked <span className="text-red-600 font-bold">*</span>. Use block letters.
              </p>
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Organization Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Organization Name <span className="text-red-500">*</span></label>
                <input type="text" required value={formData.name}
                  onChange={(e) => safeSetFormData({ ...formData, name: e.target.value.toUpperCase().trim() })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                  placeholder="e.g., ACME TRANSPORT LTD"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Entity Type <span className="text-red-500">*</span></label>
                <select required value={formData.entity_type}
                  onChange={(e) => safeSetFormData({ ...formData, entity_type: e.target.value, entity_type_other: '' })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">-- Select Entity Type --</option>
                  <option value="Company">Company</option>
                  <option value="Closed Corporation">Closed Corporation</option>
                  <option value="Trust">Trust</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {formData.entity_type === 'Other' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Please Specify <span className="text-red-500">*</span></label>
                  <input type="text" required value={formData.entity_type_other}
                    onChange={(e) => safeSetFormData({ ...formData, entity_type_other: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g., Non-profit Organisation"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Registration Number</label>
                <input type="text" value={formData.company_registration_number}
                  onChange={(e) => safeSetFormData({ ...formData, company_registration_number: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">VAT Number</label>
                <input type="text" value={formData.vat_number}
                  onChange={(e) => safeSetFormData({ ...formData, vat_number: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Website</label>
                <input type="text" value={formData.website}
                  onChange={(e) => safeSetFormData({ ...formData, website: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-3">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Organization Address</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Address Line 1</label>
              <input
                type="text"
                value={formData.address_line_1}
                onChange={(e) => safeSetFormData({ ...formData, address_line_1: e.target.value.toUpperCase() })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Address Line 2</label>
              <input
                type="text"
                value={formData.address_line_2}
                onChange={(e) => safeSetFormData({ ...formData, address_line_2: e.target.value.toUpperCase() })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => safeSetFormData({ ...formData, city: e.target.value.toUpperCase() })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
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

        {/* ORG CARD PAYMENT: Main User login + Bank Details (public mode) */}
        {publicMode && organizationPaymentType === 'card-payment' && (
          <>
            <div className="border-t pt-3">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Main User &amp; Login Details</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-xs text-blue-900 font-medium mb-1">The person completing this form will be the Main User and Billing User by default.</p>
                <p className="text-xs text-blue-800">
                  These roles can be changed after signup by logging in to the <strong>Client Portal</strong> and selecting <strong>Client User Management</strong>.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={mainUser.name}
                    onChange={(e) => safeSetMainUser({ ...mainUser, name: e.target.value.toUpperCase() })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Surname <span className="text-red-500">*</span></label>
                  <input type="text" required value={mainUser.surname}
                    onChange={(e) => safeSetMainUser({ ...mainUser, surname: e.target.value.toUpperCase() })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Email Address <span className="text-red-500">*</span></label>
                  <input type="email" required value={mainUser.email}
                    onChange={(e) => safeSetMainUser({ ...mainUser, email: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Used to sign in to the Client Portal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Password <span className="text-red-500">*</span></label>
                  <input type="password" required value={mainUser.password}
                    onChange={(e) => safeSetMainUser({ ...mainUser, password: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Minimum 6 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Mobile Number</label>
                  <input type="text" value={mainUser.phone_mobile}
                    onChange={(e) => safeSetMainUser({ ...mainUser, phone_mobile: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Office Number</label>
                  <input type="text" value={mainUser.phone_office}
                    onChange={(e) => safeSetMainUser({ ...mainUser, phone_office: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-base font-semibold text-gray-900">Bank Account Details</h3>
                <span className="text-xs text-red-500 font-medium">Required for debit order</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3">
                <p className="text-xs text-amber-900">
                  Monthly vehicle and driver management fees are collected via debit order. Provide the organisation's bank account details below.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Bank <span className="text-red-500">*</span></label>
                  <select value={clientBankDetails.bank_name}
                    onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_name: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">-- Select Bank --</option>
                    <option value="Absa">Absa</option>
                    <option value="African Bank">African Bank</option>
                    <option value="Capitec">Capitec</option>
                    <option value="Discovery Bank">Discovery Bank</option>
                    <option value="FNB">FNB</option>
                    <option value="Investec">Investec</option>
                    <option value="Nedbank">Nedbank</option>
                    <option value="Standard Bank">Standard Bank</option>
                    <option value="Tyme Bank">Tyme Bank</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Type <span className="text-red-500">*</span></label>
                  <select value={clientBankDetails.bank_account_type}
                    onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_account_type: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">-- Select Type --</option>
                    <option value="Current">Current / Cheque</option>
                    <option value="Savings">Savings</option>
                    <option value="Transmission">Transmission</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Holder Name <span className="text-red-500">*</span></label>
                  <input type="text" value={clientBankDetails.bank_account_holder}
                    onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_account_holder: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="As it appears on the account"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Account Number <span className="text-red-500">*</span></label>
                  <input type="text" value={clientBankDetails.bank_account_number}
                    onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_account_number: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Account number"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Branch Code <span className="text-red-500">*</span></label>
                  <input type="text" value={clientBankDetails.bank_branch_code}
                    onChange={(e) => setClientBankDetails({ ...clientBankDetails, bank_branch_code: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g. 250655"
                  />
                </div>
              </div>
            </div>
          </>
        )}
        </div>
        )}

        <div className="border-t pt-3">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Payment Configuration</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Fuel Payment Option <span className="text-red-500">*</span>
              </label>
              {(lockedPaymentOption || (publicMode && accountType === 'individual') || (publicMode && accountType === 'organization' && organizationPaymentType === 'card-payment')) ? (
                <div className="w-full px-2.5 py-1.5 text-sm border border-blue-200 rounded-lg bg-blue-50 text-blue-800 flex items-center gap-2">
                  <span className="font-medium">Credit/Debit Card Payment</span>
                  {publicMode && accountType === 'individual' && (
                    <span className="text-xs text-blue-600">— individuals signing up directly always pay by card</span>
                  )}
                  {publicMode && accountType === 'organization' && organizationPaymentType === 'card-payment' && (
                    <span className="text-xs text-blue-600">— selected during signup</span>
                  )}
                </div>
              ) : (
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
              )}
            </div>

            {(formData.payment_option === 'Card Payment' || (publicMode && accountType === 'individual') || (publicMode && accountType === 'organization' && organizationPaymentType === 'card-payment')) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                {/* How it works */}
                <p className="text-xs text-blue-900 font-medium">
                  Once your account is created, log in to the Client Portal with your email and password and enter your Credit/Debit card details under Financial Information. Your card is securely stored and used by drivers via PIN + NFC to authorise fuel payments at garages. You pay garages directly via your card.
                </p>

                {/* Fleet note */}
                <p className="text-xs text-blue-900">
                  Vehicles and drivers are registered after sign-up in the Client Portal under <span className="font-semibold">Fleet Management</span>. Only registered drivers assigned to a registered vehicle may use the card to pay for fuel at garages.
                </p>

                {/* Monthly fees */}
                <div className="bg-white border border-blue-200 rounded p-3 space-y-1">
                  <p className="text-xs font-semibold text-blue-900">Monthly Management Fees</p>
                  <div className="grid grid-cols-2 gap-x-4 text-xs text-blue-800">
                    <span>Per vehicle:</span>
                    <span className="font-medium">R{formData.monthly_fee_per_vehicle > 0 ? formData.monthly_fee_per_vehicle.toFixed(2) : '—'} / month</span>
                    <span>Per driver:</span>
                    <span className="font-medium">R{formData.monthly_fee_per_driver > 0 ? formData.monthly_fee_per_driver.toFixed(2) : '—'} / month</span>
                  </div>
                  <p className="text-xs text-blue-700 pt-1">
                    Fees are calculated monthly based on the number of active vehicles and drivers on your account.
                  </p>
                </div>

                {/* Direct debit notice */}
                <div className="bg-white border border-blue-200 rounded p-3 space-y-1">
                  <p className="text-xs font-semibold text-blue-900">Fee Collection — Direct Debit</p>
                  <p className="text-xs text-blue-800">
                    Monthly management fees are collected by direct debit raised by <span className="font-semibold">{bankDetails.company_name}</span> against your registered bank account. No action is required from you — the debit will appear on your bank statement each month.
                  </p>
                </div>

                {/* Direct debit authorisation */}
                {publicMode && (accountType === 'individual' || (accountType === 'organization' && organizationPaymentType === 'card-payment')) && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={debitOrderAuthorised}
                      onChange={e => setDebitOrderAuthorised(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                    <span className="text-xs text-blue-900">
                      I authorise <span className="font-semibold">{bankDetails.company_name}</span> to raise a direct debit against my account monthly for vehicle and driver management fees as set out above, and confirm that I have read and understood the fee structure.
                    </span>
                  </label>
                )}

                {!publicMode && (
                  <p className="text-xs text-blue-800 border-t border-blue-200 pt-2">
                    Note: Card will be configured after organisation creation in the Financial Information section.
                  </p>
                )}
              </div>
            )}

            {formData.payment_option === 'Local Account' && !(publicMode && accountType === 'individual') && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-900 font-medium">
                  Client has existing local accounts with garages. MyFuelApp manages fuel transactions and billing. Client pays MyFuelApp for management fees only. Fuel costs are settled through existing local account arrangements.
                </p>
              </div>
            )}

            {!publicMode && (
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
            )}
          </div>
        </div>

        {accountType !== 'individual' && !(publicMode && accountType === 'organization' && organizationPaymentType === 'card-payment') && <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold text-gray-900">Main User &amp; Contact Person</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={mainUser.name}
                onChange={(e) => safeSetMainUser({ ...mainUser, name: e.target.value.toUpperCase() })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
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
                onChange={(e) => safeSetMainUser({ ...mainUser, surname: e.target.value.toUpperCase() })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
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
        </div>}

        {!(publicMode && accountType === 'individual') && !(publicMode && accountType === 'organization' && organizationPaymentType === 'card-payment') && <div className="border-t pt-3">
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
        </div>}

        {managingGarageId && !(publicMode && accountType === 'individual') && !(publicMode && accountType === 'organization' && organizationPaymentType === 'card-payment') && (
          <div className="border-t pt-3">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Garage Account</h3>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Account Number
              </label>
              <input
                type="text"
                placeholder="e.g. ACC-0042"
                value={garageAccountNumber}
                onChange={(e) => setGarageAccountNumber(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-0.5">The account reference used for this client at your garage. Can be set now or updated later.</p>
            </div>
          </div>
        )}

        {!publicMode && <div className="border-t pt-3">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Financial Settings</h3>
          <div className="grid grid-cols-2 gap-3">
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
                Monthly Fee Per Driver (R)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.monthly_fee_per_driver}
                onFocus={(e) => e.target.select()}
                onChange={(e) => safeSetFormData({ ...formData, monthly_fee_per_driver: parseFloat(e.target.value) })}
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
        </div>}

        <div className="border-t pt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onNavigate && onNavigate(publicMode ? 'back-to-home' : 'client-organizations-menu')}
            className="bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-300 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Creating...' : (publicMode ? 'Sign Up' : 'Create Client')}
          </button>
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
                  if (onNavigate) onNavigate(publicMode ? 'back-to-home' : 'client-organizations-menu');
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
