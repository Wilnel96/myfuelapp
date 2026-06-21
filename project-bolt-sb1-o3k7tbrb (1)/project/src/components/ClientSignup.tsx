import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Fuel, AlertCircle, ArrowLeft, Building2, User, Mail, Lock, Phone, MapPin, CreditCard } from 'lucide-react';

interface ClientSignupProps {
  portalType: 'card' | 'account' | 'both';
  onBack: () => void;
  onSignupSuccess: () => void;
}

const SA_PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
];

export default function ClientSignup({ portalType, onBack, onSignupSuccess }: ClientSignupProps) {
  const [step, setStep] = useState<'type' | 'org' | 'user'>('type');
  const [accountType, setAccountType] = useState<'individual' | 'organization' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [orgData, setOrgData] = useState({
    name: '',
    registration_number: '',
    vat_number: '',
    email: '',
    phone_number: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    province: '',
    postal_code: '',
  });

  const [userData, setUserData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    id_number: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    province: '',
    postal_code: '',
    password: '',
    confirmPassword: '',
  });

  const up = (v: string) => v.toUpperCase();

  const handleTypeSelection = (type: 'individual' | 'organization') => {
    setAccountType(type);
    setStep(type === 'individual' ? 'user' : 'org');
  };

  const handleOrgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!orgData.name || !orgData.email) {
      setError('Organisation name and email are required');
      return;
    }
    setStep('user');
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!userData.first_name || !userData.last_name || !userData.email || !userData.password) {
        throw new Error('All required fields must be completed');
      }
      if (userData.password !== userData.confirmPassword) {
        throw new Error('Passwords do not match');
      }
      if (userData.password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }
      if (accountType === 'individual' && !userData.id_number) {
        throw new Error('SA ID number is required for individual accounts');
      }

      const orgName = accountType === 'individual'
        ? `${userData.first_name} ${userData.last_name}`
        : orgData.name;

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.first_name,
            surname: userData.last_name,
            organization_name: orgName,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create user account');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError || !profile?.organization_id) {
        throw new Error('Failed to fetch user profile');
      }

      const { data: feeSetting } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'monthly_fee_per_vehicle')
        .maybeSingle();
      const defaultMonthlyFee = feeSetting?.value ? parseFloat(feeSetting.value) : 10;

      const { error: orgUpdateError } = await supabase
        .from('organizations')
        .update({
          company_registration_number: accountType === 'individual'
            ? userData.id_number
            : (orgData.registration_number.toUpperCase() || null),
          vat_number: accountType === 'individual' ? null : (orgData.vat_number.toUpperCase() || null),
          email: accountType === 'individual' ? userData.email : orgData.email,
          phone_number: accountType === 'individual'
            ? (userData.phone_number || null)
            : (orgData.phone_number || null),
          address_line_1: accountType === 'individual'
            ? (userData.address_line_1.toUpperCase() || null)
            : (orgData.address_line_1.toUpperCase() || null),
          address_line_2: accountType === 'individual'
            ? (userData.address_line_2.toUpperCase() || null)
            : (orgData.address_line_2.toUpperCase() || null),
          city: accountType === 'individual'
            ? (userData.city.toUpperCase() || null)
            : (orgData.city.toUpperCase() || null),
          province: accountType === 'individual' ? (userData.province || null) : (orgData.province || null),
          postal_code: accountType === 'individual' ? (userData.postal_code || null) : (orgData.postal_code || null),
          account_type: accountType,
          payment_option: portalType === 'card' ? 'Card Payment' : portalType === 'account' ? 'Local Account' : 'Both',
          is_management_org: false,
          organization_type: 'client',
          monthly_fee_per_vehicle: defaultMonthlyFee,
        })
        .eq('id', profile.organization_id);

      if (orgUpdateError) throw new Error(`Failed to update organisation: ${orgUpdateError.message}`);

      await supabase
        .from('organization_users')
        .update({
          phone_mobile: userData.phone_number || null,
          id_number: accountType === 'individual' ? userData.id_number : null,
        })
        .eq('user_id', authData.user.id)
        .eq('organization_id', profile.organization_id);

      await supabase
        .from('profiles')
        .update({ id_number: accountType === 'individual' ? userData.id_number : null })
        .eq('id', authData.user.id);

      onSignupSuccess();
    } catch (err: any) {
      setError(err.message || 'Signup failed');
      setLoading(false);
    }
  };

  const accentCls = portalType === 'card' ? 'blue' : 'amber';
  const ringCls = `focus:ring-${accentCls}-500`;
  const btnCls = `w-full bg-${accentCls}-600 text-white py-3 rounded-lg font-semibold hover:bg-${accentCls}-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed`;

  const inputCls = `w-full px-4 py-2 border border-gray-300 rounded-lg ${ringCls} focus:border-transparent uppercase`;
  const plInputCls = `w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg ${ringCls} focus:border-transparent uppercase`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-r from-${accentCls}-500 to-${accentCls}-600 text-white p-6`}>
          <div className="flex items-center justify-center gap-3 mb-2">
            <Fuel className="w-10 h-10" />
            <h1 className="text-2xl font-bold">MyFuelApp</h1>
          </div>
          <p className={`text-${accentCls}-100 text-sm text-center`}>Create Your Card Account</p>
        </div>

        <div className="p-6">
          <button
            onClick={onBack}
            className={`text-${accentCls}-600 hover:text-${accentCls}-700 font-medium flex items-center gap-2 mb-4`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </button>

          {/* Card payment info banner */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
            <CreditCard className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Credit / Debit Card Account</strong> — You are signing up for a MyFuelApp card payment account. Fuel purchases will be charged to your card. If you need a garage-managed local account, please contact your garage directly.
            </div>
          </div>

          {/* Step indicator */}
          {step !== 'type' && (
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-2 ${accentCls === 'blue' ? 'text-blue-600' : 'text-amber-600'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-${accentCls}-100`}>
                    {accountType === 'individual' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                  </div>
                  <span className="font-medium text-sm">
                    {accountType === 'individual' ? 'Individual' : 'Organisation'}
                  </span>
                </div>
                <div className="flex-1 h-0.5 bg-gray-200" />
                <div className={`flex items-center gap-2 ${step === 'user' ? (accentCls === 'blue' ? 'text-blue-600' : 'text-amber-600') : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'user' ? `bg-${accentCls}-100` : 'bg-gray-100'}`}>
                    <User className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Account</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* ── Type selection ── */}
          {step === 'type' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 text-center mb-6">Select Account Type</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleTypeSelection('individual')}
                  className={`p-6 border-2 border-gray-200 rounded-xl hover:border-${accentCls}-500 hover:bg-${accentCls}-50 transition-all group`}
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className={`w-16 h-16 bg-${accentCls}-100 rounded-full flex items-center justify-center group-hover:bg-${accentCls}-200 transition-colors`}>
                      <User className={`w-8 h-8 text-${accentCls}-600`} />
                    </div>
                    <h4 className="font-semibold text-gray-900">Individual</h4>
                    <p className="text-sm text-gray-600">Personal card account for an individual</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeSelection('organization')}
                  className={`p-6 border-2 border-gray-200 rounded-xl hover:border-${accentCls}-500 hover:bg-${accentCls}-50 transition-all group`}
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className={`w-16 h-16 bg-${accentCls}-100 rounded-full flex items-center justify-center group-hover:bg-${accentCls}-200 transition-colors`}>
                      <Building2 className={`w-8 h-8 text-${accentCls}-600`} />
                    </div>
                    <h4 className="font-semibold text-gray-900">Organisation</h4>
                    <p className="text-sm text-gray-600">Business or company card account</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── Organisation details ── */}
          {step === 'org' && (
            <form onSubmit={handleOrgSubmit} className="space-y-4">
              <h3 className="font-semibold text-gray-900 mb-3">Organisation Information</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organisation Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" value={orgData.name}
                    onChange={e => setOrgData(d => ({ ...d, name: up(e.target.value) }))}
                    className={plInputCls} required />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                  <input type="text" value={orgData.registration_number}
                    onChange={e => setOrgData(d => ({ ...d, registration_number: up(e.target.value) }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
                  <input type="text" value={orgData.vat_number}
                    onChange={e => setOrgData(d => ({ ...d, vat_number: up(e.target.value) }))}
                    className={inputCls} />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organisation Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="email" value={orgData.email}
                      onChange={e => setOrgData(d => ({ ...d, email: e.target.value.toLowerCase() }))}
                      className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg ${ringCls} focus:border-transparent lowercase`}
                      required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="tel" value={orgData.phone_number}
                      onChange={e => setOrgData(d => ({ ...d, phone_number: e.target.value }))}
                      className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg ${ringCls} focus:border-transparent`} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" value={orgData.address_line_1}
                    onChange={e => setOrgData(d => ({ ...d, address_line_1: up(e.target.value) }))}
                    className={plInputCls} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <input type="text" value={orgData.address_line_2}
                  onChange={e => setOrgData(d => ({ ...d, address_line_2: up(e.target.value) }))}
                  className={inputCls} />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input type="text" value={orgData.city}
                    onChange={e => setOrgData(d => ({ ...d, city: up(e.target.value) }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                  <select value={orgData.province}
                    onChange={e => setOrgData(d => ({ ...d, province: e.target.value }))}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${ringCls} focus:border-transparent`}>
                    <option value="">Select...</option>
                    {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                  <input type="text" value={orgData.postal_code}
                    onChange={e => setOrgData(d => ({ ...d, postal_code: e.target.value }))}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${ringCls} focus:border-transparent`} />
                </div>
              </div>

              <button type="submit" className={btnCls}>
                Continue to Account Details
              </button>
            </form>
          )}

          {/* ── User / account details ── */}
          {step === 'user' && (
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Your Account Details</h3>
                <button type="button"
                  onClick={() => accountType === 'organization' ? setStep('org') : setStep('type')}
                  className="text-sm text-gray-600 hover:text-gray-700">
                  ← Back
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" value={userData.first_name}
                      onChange={e => setUserData(d => ({ ...d, first_name: up(e.target.value) }))}
                      className={plInputCls} required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Surname <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={userData.last_name}
                    onChange={e => setUserData(d => ({ ...d, last_name: up(e.target.value) }))}
                    className={inputCls} required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="email" value={userData.email}
                    onChange={e => setUserData(d => ({ ...d, email: e.target.value.toLowerCase() }))}
                    className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg ${ringCls} focus:border-transparent lowercase`}
                    required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="tel" value={userData.phone_number}
                    onChange={e => setUserData(d => ({ ...d, phone_number: e.target.value }))}
                    className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg ${ringCls} focus:border-transparent`} />
                </div>
              </div>

              {accountType === 'individual' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SA ID Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type="text" value={userData.id_number}
                        onChange={e => setUserData(d => ({ ...d, id_number: e.target.value }))}
                        className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg ${ringCls} focus:border-transparent`}
                        required maxLength={13} placeholder="13-digit ID number" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">South African ID number (13 digits)</p>
                  </div>

                  <div className="pt-2">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Residential Address
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input type="text" value={userData.address_line_1}
                            onChange={e => setUserData(d => ({ ...d, address_line_1: up(e.target.value) }))}
                            className={plInputCls} placeholder="STREET ADDRESS" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                        <input type="text" value={userData.address_line_2}
                          onChange={e => setUserData(d => ({ ...d, address_line_2: up(e.target.value) }))}
                          className={inputCls} placeholder="SUBURB, UNIT, ETC." />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                          <input type="text" value={userData.city}
                            onChange={e => setUserData(d => ({ ...d, city: up(e.target.value) }))}
                            className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${ringCls} focus:border-transparent uppercase`} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                          <select value={userData.province}
                            onChange={e => setUserData(d => ({ ...d, province: e.target.value }))}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${ringCls} focus:border-transparent`}>
                            <option value="">Select...</option>
                            {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                          <input type="text" value={userData.postal_code}
                            onChange={e => setUserData(d => ({ ...d, postal_code: e.target.value }))}
                            className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${ringCls} focus:border-transparent`} />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="password" value={userData.password}
                    onChange={e => setUserData(d => ({ ...d, password: e.target.value }))}
                    className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg ${ringCls} focus:border-transparent`}
                    required minLength={8} />
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="password" value={userData.confirmPassword}
                    onChange={e => setUserData(d => ({ ...d, confirmPassword: e.target.value }))}
                    className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg ${ringCls} focus:border-transparent`}
                    required />
                </div>
              </div>

              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? 'Creating Account...' : 'Create Card Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
