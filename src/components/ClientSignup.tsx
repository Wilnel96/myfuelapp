import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Fuel, AlertCircle, ArrowLeft, Building2, User, Mail, Lock, Phone, MapPin, CreditCard } from 'lucide-react';

interface ClientSignupProps {
  portalType: 'card' | 'account';
  onBack: () => void;
  onSignupSuccess: () => void;
}

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
    password: '',
    confirmPassword: '',
  });

  const handleTypeSelection = (type: 'individual' | 'organization') => {
    setAccountType(type);
    if (type === 'individual') {
      setStep('user');
    } else {
      setStep('org');
    }
  };

  const handleOrgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!orgData.name || !orgData.email) {
      setError('Organization name and email are required');
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
        throw new Error('All user fields are required');
      }

      if (userData.password !== userData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (userData.password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      if (accountType === 'individual' && !userData.id_number) {
        throw new Error('ID number is required for individual accounts');
      }

      const paymentOption = portalType === 'card' ? 'Card Payment' : 'Local Account';
      const orgName = accountType === 'individual'
        ? `${userData.first_name} ${userData.last_name}`
        : orgData.name;

      console.log('[Signup] Creating user account with organization data...');
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

      console.log('[Signup] User created:', authData.user.id);

      // Use SECURITY DEFINER RPC to update org data — avoids RLS timing issues
      // that occur because the session may not be active yet after signUp()
      console.log('[Signup] Saving organization details via RPC...');
      const { data: rpcResult, error: rpcError } = await supabase.rpc('complete_client_signup', {
        p_user_id: authData.user.id,
        p_registration_number: accountType === 'individual' ? userData.id_number : (orgData.registration_number || null),
        p_vat_number: accountType === 'individual' ? null : (orgData.vat_number || null),
        p_email: accountType === 'individual' ? userData.email : orgData.email,
        p_phone_number: accountType === 'individual' ? (userData.phone_number || null) : (orgData.phone_number || null),
        p_address_line_1: orgData.address_line_1 || null,
        p_address_line_2: orgData.address_line_2 || null,
        p_city: orgData.city || null,
        p_province: orgData.province || null,
        p_postal_code: orgData.postal_code || null,
        p_payment_option: paymentOption,
        p_mobile_phone: userData.phone_number || null,
        p_id_number: accountType === 'individual' ? userData.id_number : null,
        p_account_type: accountType === 'individual' ? 'individual' : 'company',
      });

      if (rpcError) {
        console.error('[Signup] RPC error:', rpcError);
        throw new Error(`Failed to save organization details: ${rpcError.message}`);
      }

      if (rpcResult && !rpcResult.success) {
        console.error('[Signup] RPC returned failure:', rpcResult.error);
        throw new Error(rpcResult.error || 'Failed to save organization details');
      }

      console.log('[Signup] Signup complete!');
      onSignupSuccess();

    } catch (err: any) {
      console.error('[Signup] Error:', err);
      setError(err.message || 'Signup failed');
      setLoading(false);
    }
  };

  const portalTitle = portalType === 'card' ? 'MyFuel Card' : 'MyFuel Accounts';
  const portalColor = portalType === 'card' ? 'blue' : 'amber';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className={`bg-gradient-to-r from-${portalColor}-500 to-${portalColor}-600 text-white p-6`}>
          <div className="flex items-center justify-center gap-3 mb-2">
            <Fuel className="w-10 h-10" />
            <h1 className="text-2xl font-bold">{portalTitle}</h1>
          </div>
          <p className={`text-${portalColor}-100 text-sm text-center`}>Create Your Account</p>
        </div>

        <div className="p-6">
          <button
            onClick={onBack}
            className={`text-${portalColor}-600 hover:text-${portalColor}-700 font-medium flex items-center gap-2 mb-4`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </button>

          {step !== 'type' && (
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-2 ${step === 'org' || accountType === 'organization' ? 'text-' + portalColor + '-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'org' ? 'bg-' + portalColor + '-100' : 'bg-gray-100'}`}>
                    {accountType === 'individual' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                  </div>
                  <span className="font-medium text-sm">
                    {accountType === 'individual' ? 'Individual' : 'Organization'}
                  </span>
                </div>
                <div className="flex-1 h-0.5 bg-gray-200"></div>
                <div className={`flex items-center gap-2 ${step === 'user' ? 'text-' + portalColor + '-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'user' ? 'bg-' + portalColor + '-100' : 'bg-gray-100'}`}>
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

          {step === 'type' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 text-center mb-6">Select Account Type</h3>

              <div className="grid md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleTypeSelection('individual')}
                  className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <User className="w-8 h-8 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Individual</h4>
                    <p className="text-sm text-gray-600">
                      Personal account for individual use
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeSelection('organization')}
                  className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <Building2 className="w-8 h-8 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Organization</h4>
                    <p className="text-sm text-gray-600">
                      Business or company account
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 'org' && (
            <form onSubmit={handleOrgSubmit} className="space-y-4">
              <h3 className="font-semibold text-gray-900 mb-3">Organization Information</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={orgData.name}
                    onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    value={orgData.registration_number}
                    onChange={(e) => setOrgData({ ...orgData, registration_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    VAT Number
                  </label>
                  <input
                    type="text"
                    value={orgData.vat_number}
                    onChange={(e) => setOrgData({ ...orgData, vat_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={orgData.email}
                      onChange={(e) => setOrgData({ ...orgData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={orgData.phone_number}
                      onChange={(e) => setOrgData({ ...orgData, phone_number: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={orgData.address_line_1}
                    onChange={(e) => setOrgData({ ...orgData, address_line_1: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={orgData.address_line_2}
                  onChange={(e) => setOrgData({ ...orgData, address_line_2: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={orgData.city}
                    onChange={(e) => setOrgData({ ...orgData, city: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Province
                  </label>
                  <select
                    value={orgData.province}
                    onChange={(e) => setOrgData({ ...orgData, province: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={orgData.postal_code}
                    onChange={(e) => setOrgData({ ...orgData, postal_code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                className={`w-full bg-${portalColor}-600 text-white py-3 rounded-lg font-semibold hover:bg-${portalColor}-700 transition-colors`}
              >
                Continue to User Account
              </button>
            </form>
          )}

          {step === 'user' && (
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Your Account Information</h3>
                <button
                  type="button"
                  onClick={() => accountType === 'organization' ? setStep('org') : setStep('type')}
                  className="text-sm text-gray-600 hover:text-gray-700"
                >
                  ← Back
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={userData.first_name}
                      onChange={(e) => setUserData({ ...userData, first_name: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Surname <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={userData.last_name}
                    onChange={(e) => setUserData({ ...userData, last_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={userData.email}
                    onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={userData.phone_number}
                    onChange={(e) => setUserData({ ...userData, phone_number: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {accountType === 'individual' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ID Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={userData.id_number}
                        onChange={(e) => setUserData({ ...userData, id_number: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required={accountType === 'individual'}
                        maxLength={13}
                        placeholder="13-digit ID number"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">South African ID number (13 digits)</p>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      Address
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                        <input
                          type="text"
                          value={orgData.address_line_1}
                          onChange={(e) => setOrgData({ ...orgData, address_line_1: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Street address"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                        <input
                          type="text"
                          value={orgData.address_line_2}
                          onChange={(e) => setOrgData({ ...orgData, address_line_2: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Suburb / Unit / Building"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                          <input
                            type="text"
                            value={orgData.city}
                            onChange={(e) => setOrgData({ ...orgData, city: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                          <select
                            value={orgData.province}
                            onChange={(e) => setOrgData({ ...orgData, province: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Select...</option>
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
                          <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                          <input
                            type="text"
                            value={orgData.postal_code}
                            onChange={(e) => setOrgData({ ...orgData, postal_code: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
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
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={userData.password}
                    onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    minLength={8}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={userData.confirmPassword}
                    onChange={(e) => setUserData({ ...userData, confirmPassword: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed`}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
