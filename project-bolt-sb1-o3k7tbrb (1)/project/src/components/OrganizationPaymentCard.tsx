import React, { useState, useEffect } from 'react';
import { CreditCard, Lock, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PaymentCard {
  id: string;
  card_brand: string;
  last_four_digits: string;
  card_nickname: string;
  card_type: string;
  is_default: boolean;
  created_at: string;
}

export function OrganizationPaymentCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [existingCard, setExistingCard] = useState<PaymentCard | null>(null);
  const [showCardNumber, setShowCardNumber] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(true);

  const [formData, setFormData] = useState({
    cardNumber: '',
    cardHolderName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    cardPin: '',
    cardType: 'debit' as 'debit' | 'credit',
    cardNickname: '',
  });

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      setCheckingPermissions(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Not authenticated');
        setCheckingPermissions(false);
        return;
      }

      // Check if user is super admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'super_admin') {
        setIsAuthorized(true);
        setCheckingPermissions(false);
        await loadExistingCard();
        return;
      }

      // Check if user is main user or secondary main user
      const { data: orgUser } = await supabase
        .from('organization_users')
        .select('is_main_user, is_secondary_main_user, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (orgUser && (orgUser.is_main_user || orgUser.is_secondary_main_user)) {
        setIsAuthorized(true);
        await loadExistingCard();
      } else {
        setIsAuthorized(false);
        setError('Access Denied: Only Main Users and Secondary Main Users can register payment cards.');
      }
    } catch (err) {
      console.error('Error checking permissions:', err);
      setError('Failed to verify permissions');
    } finally {
      setCheckingPermissions(false);
    }
  };

  const loadExistingCard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      const { data } = await supabase
        .from('organization_payment_cards')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .eq('is_default', true)
        .maybeSingle();

      if (data) {
        setExistingCard(data);
      } else {
        setShowForm(true);
      }
    } catch (err) {
      console.error('Error loading card:', err);
    }
  };

  const detectCardBrand = (number: string): string => {
    const cleaned = number.replace(/\s/g, '');
    if (/^4/.test(cleaned)) return 'Visa';
    if (/^5[1-5]/.test(cleaned)) return 'Mastercard';
    if (/^3[47]/.test(cleaned)) return 'American Express';
    return 'Unknown';
  };

  const formatCardNumber = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    const groups = cleaned.match(/.{1,4}/g) || [];
    return groups.join(' ');
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.replace(/\s/g, '').length <= 19) {
      setFormData({ ...formData, cardNumber: formatted });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        throw new Error('Profile not found');
      }

      const cardNumberClean = formData.cardNumber.replace(/\s/g, '');
      const cardBrand = detectCardBrand(cardNumberClean);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/encrypt-card-data`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organizationId: profile.organization_id,
            cardNumber: cardNumberClean,
            cardHolderName: formData.cardHolderName,
            expiryMonth: formData.expiryMonth,
            expiryYear: formData.expiryYear,
            cvv: formData.cvv,
            cardPin: formData.cardPin,
            cardType: formData.cardType,
            cardBrand,
            cardNickname: formData.cardNickname || `${cardBrand} •••• ${cardNumberClean.slice(-4)}`,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.errorCode === 'ENCRYPTION_KEY_NOT_CONFIGURED') {
          throw new Error('ENCRYPTION_NOT_CONFIGURED: ' + result.error);
        }
        throw new Error(result.error || 'Failed to register card');
      }

      setSuccess('Payment card registered successfully!');
      setShowForm(false);
      setFormData({
        cardNumber: '',
        cardHolderName: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: '',
        cardPin: '',
        cardType: 'debit',
        cardNickname: '',
      });

      await loadExistingCard();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to register payment card';
      if (errorMessage.includes('ENCRYPTION_NOT_CONFIGURED:')) {
        setError(errorMessage.replace('ENCRYPTION_NOT_CONFIGURED: ', ''));
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => currentYear + i);
  const months = [
    { value: '01', label: '01 - January' },
    { value: '02', label: '02 - February' },
    { value: '03', label: '03 - March' },
    { value: '04', label: '04 - April' },
    { value: '05', label: '05 - May' },
    { value: '06', label: '06 - June' },
    { value: '07', label: '07 - July' },
    { value: '08', label: '08 - August' },
    { value: '09', label: '09 - September' },
    { value: '10', label: '10 - October' },
    { value: '11', label: '11 - November' },
    { value: '12', label: '12 - December' },
  ];

  if (checkingPermissions) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Payment Card</h2>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
          <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Secure Storage</p>
            <p>Your card details are encrypted and stored securely. Card data is only decrypted during active payments with valid driver PIN verification and the card data is transferred via NFC.</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">Access Restricted</h3>
              <p className="text-red-800 mb-4">
                Only Main Users and Secondary Main Users are authorized to register and manage payment cards for the organization.
              </p>
              <p className="text-sm text-red-700">
                If you need access to this feature, please contact your organization's Main User.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (existingCard && !showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Payment Card</h2>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Replace Card
          </button>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 text-white shadow-xl">
          <div className="flex justify-between items-start mb-8">
            <CreditCard className="w-10 h-10" />
            <Lock className="w-5 h-5" />
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-blue-200 text-sm mb-1">Card Number</p>
              <p className="text-xl tracking-wider font-mono">
                •••• •••• •••• {existingCard.last_four_digits}
              </p>
            </div>

            <div className="flex justify-between items-end">
              <div>
                <p className="text-blue-200 text-sm mb-1">Card Type</p>
                <p className="capitalize">{existingCard.card_type}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{existingCard.card_brand}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
          <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Secure Storage</p>
            <p>Your card details are encrypted and stored securely. Card data is only decrypted during active payments with valid driver PIN verification and the card data is transferred via NFC.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Register Payment Card</h2>
        {existingCard && (
          <button
            onClick={() => setShowForm(false)}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        )}
      </div>

      {error && (
        <div className={`border rounded-lg p-4 flex items-start space-x-3 ${
          error.includes('MASTER_ENCRYPTION_KEY') || error.includes('not configured')
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
            error.includes('MASTER_ENCRYPTION_KEY') || error.includes('not configured')
              ? 'text-yellow-600'
              : 'text-red-600'
          }`} />
          <div className={`text-sm ${
            error.includes('MASTER_ENCRYPTION_KEY') || error.includes('not configured')
              ? 'text-yellow-800'
              : 'text-red-800'
          }`}>
            <p className="font-medium mb-1">
              {error.includes('MASTER_ENCRYPTION_KEY') || error.includes('not configured')
                ? 'Configuration Required'
                : 'Error'}
            </p>
            <p>{error}</p>
            {(error.includes('MASTER_ENCRYPTION_KEY') || error.includes('not configured')) && (
              <div className="mt-3 text-xs space-y-1">
                <p className="font-medium">Setup Instructions:</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Go to Supabase Dashboard → Project Settings → Edge Functions</li>
                  <li>Scroll to "Secrets" section</li>
                  <li>Add secret: MASTER_ENCRYPTION_KEY with a 32-character random key</li>
                  <li>Save and retry</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Type
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                value="debit"
                checked={formData.cardType === 'debit'}
                onChange={(e) => setFormData({ ...formData, cardType: e.target.value as 'debit' | 'credit' })}
                className="w-4 h-4"
              />
              <span>Debit Card</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                value="credit"
                checked={formData.cardType === 'credit'}
                onChange={(e) => setFormData({ ...formData, cardType: e.target.value as 'debit' | 'credit' })}
                className="w-4 h-4"
              />
              <span>Credit Card</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Number
          </label>
          <div className="relative">
            <input
              type={showCardNumber ? 'text' : 'password'}
              value={formData.cardNumber}
              onChange={handleCardNumberChange}
              placeholder="1234 5678 9012 3456"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
            <button
              type="button"
              onClick={() => setShowCardNumber(!showCardNumber)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showCardNumber ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cardholder Name
          </label>
          <input
            type="text"
            value={formData.cardHolderName}
            onChange={(e) => setFormData({ ...formData, cardHolderName: e.target.value.toUpperCase() })}
            placeholder="JOHN SMITH"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expiry Month
            </label>
            <select
              value={formData.expiryMonth}
              onChange={(e) => setFormData({ ...formData, expiryMonth: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">MM</option>
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expiry Year
            </label>
            <select
              value={formData.expiryYear}
              onChange={(e) => setFormData({ ...formData, expiryYear: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">YYYY</option>
              {years.map((year) => (
                <option key={year} value={year.toString()}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CVV
            </label>
            <div className="relative">
              <input
                type={showCvv ? 'text' : 'password'}
                value={formData.cvv}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 4) {
                    setFormData({ ...formData, cvv: value });
                  }
                }}
                placeholder="123"
                required
                maxLength={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
              <button
                type="button"
                onClick={() => setShowCvv(!showCvv)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showCvv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card PIN <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPin ? 'text' : 'password'}
              value={formData.cardPin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 6) {
                  setFormData({ ...formData, cardPin: value });
                }
              }}
              placeholder="Enter 4-6 digit PIN"
              required
              minLength={4}
              maxLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            This PIN will be displayed to drivers when they make NFC payments so they can enter it on the garage's card reader
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Nickname (Optional)
          </label>
          <input
            type="text"
            value={formData.cardNickname}
            onChange={(e) => setFormData({ ...formData, cardNickname: e.target.value })}
            placeholder="Company Main Card"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">Security Notice</p>
            <p>Card details will be encrypted using AES-256-GCM encryption before storage. Only authorized drivers with valid PINs can initiate payments. Card details are never displayed after registration.</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Encrypting and Saving...' : 'Register Card Securely'}
        </button>
      </form>
    </div>
  );
}
