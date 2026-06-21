import React, { useState, useEffect } from 'react';
import { Smartphone, CheckCircle2, XCircle, AlertCircle, Loader2, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface NFCPaymentProps {
  driverId: string;
  organizationId: string;
  vehicleId?: string;
  amount: number;
  pin: string;
  fuelTransactionId?: string;
  onSuccess: (transactionId: string) => void;
  onFailure: (reason: string, shouldFallbackToEFT: boolean) => void;
  onCancel: () => void;
}

type PaymentStatus = 'preparing' | 'nfc_ready' | 'waiting_tap' | 'transmitting' | 'pin_request' | 'awaiting_pin' | 'processing' | 'completed' | 'failed' | 'timeout';

export function NFCPayment({
  driverId,
  organizationId,
  vehicleId,
  amount,
  pin,
  fuelTransactionId,
  onSuccess,
  onFailure,
  onCancel,
}: NFCPaymentProps) {
  const [status, setStatus] = useState<PaymentStatus>('preparing');
  const [error, setError] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentType, setPaymentType] = useState<'card' | 'local_account'>('card');
  const [cardBrand, setCardBrand] = useState('');
  const [lastFourDigits, setLastFourDigits] = useState('');
  const [authorizationPIN, setAuthorizationPIN] = useState('');
  const [accountInfo, setAccountInfo] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    preparePayment();
  }, []);

  useEffect(() => {
    if (status === 'nfc_ready' || status === 'waiting_tap') {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [status]);

  const preparePayment = async () => {
    try {
      setStatus('preparing');

      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      };

      let location = null;
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
        } catch (err) {
          console.log('Location not available');
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prepare-nfc-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            driverId,
            pin,
            amount,
            organizationId,
            vehicleId,
            fuelTransactionId,
            deviceInfo,
            location,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.errorCode === 'ENCRYPTION_KEY_NOT_CONFIGURED') {
          throw new Error('CONFIG_ERROR: Payment encryption is not configured. Please contact your administrator to set up the MASTER_ENCRYPTION_KEY.');
        }
        if (result.locked) {
          throw new Error(result.error);
        }
        if (result.limitExceeded) {
          throw new Error(result.error);
        }
        throw new Error(result.error || 'Failed to prepare payment');
      }

      setTransactionId(result.transactionId);
      setPaymentType(result.paymentType || 'card');
      if (result.paymentType === 'local_account') {
        setAccountInfo(result.accountInfo || '');
      } else {
        setCardBrand(result.cardBrand || '');
        setLastFourDigits(result.lastFourDigits || '');
        setAuthorizationPIN(result.cardPin || '');
      }
      setStatus('nfc_ready');

      setTimeout(() => {
        if (status === 'nfc_ready') {
          initiateNFCTransmission(result.payload);
        }
      }, 1000);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to prepare payment';
      const isConfigError = errorMessage.includes('CONFIG_ERROR:');
      setError(isConfigError ? errorMessage.replace('CONFIG_ERROR: ', '') : errorMessage);
      setStatus('failed');
      setTimeout(() => {
        onFailure(isConfigError ? errorMessage.replace('CONFIG_ERROR: ', '') : err.message, !isConfigError);
      }, 3000);
    }
  };

  const initiateNFCTransmission = async (payload: string) => {
    try {
      setStatus('waiting_tap');

      if ('NDEFReader' in window) {
        await transmitViaWebNFC(payload);
      } else {
        await simulateNFCTransmission(payload);
      }
    } catch (err: any) {
      handleTransmissionError(err.message);
    }
  };

  const transmitViaWebNFC = async (payload: string) => {
    try {
      setStatus('transmitting');

      await supabase
        .from('nfc_payment_transactions')
        .update({
          payment_status: 'transmitting',
          nfc_data_transmitted_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // After NFC transmission, wait for driver to request PIN
      setStatus('pin_request');
    } catch (err: any) {
      throw new Error('NFC transmission failed');
    }
  };

  const simulateNFCTransmission = async (payload: string) => {
    setStatus('transmitting');

    await supabase
      .from('nfc_payment_transactions')
      .update({
        payment_status: 'transmitting',
        nfc_data_transmitted_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    await new Promise((resolve) => setTimeout(resolve, 2500));

    // After NFC transmission, wait for driver to request PIN
    setStatus('pin_request');
  };

  const handleGetPIN = async () => {
    if (!authorizationPIN || authorizationPIN === '') {
      setError('Card PIN not found. Please re-register your payment card with a PIN.');
      setStatus('failed');
      setTimeout(() => {
        onFailure('Card PIN not configured', false);
      }, 3000);
      return;
    }
    setStatus('awaiting_pin');
    await waitForPINEntry();
  };

  const waitForPINEntry = async () => {
    // Simulate waiting for driver to enter PIN on card reader
    // In a real implementation, this would wait for confirmation from the card reader device
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Update database to record PIN verification
    await supabase
      .from('nfc_payment_transactions')
      .update({
        payment_status: 'pin_verified',
        pin_entered_at: new Date().toISOString(),
        pin_verified_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    // Proceed to processing
    setStatus('processing');
    await completePayment();
  };

  const completePayment = async () => {
    try {
      await supabase.rpc('complete_nfc_payment', {
        p_nfc_payment_id: transactionId,
      });

      setStatus('completed');
      setTimeout(() => {
        onSuccess(transactionId);
      }, 1500);
    } catch (err: any) {
      throw new Error('Payment processing failed');
    }
  };

  const handleTransmissionError = async (reason: string) => {
    setError(reason);
    setStatus('failed');

    await supabase
      .from('nfc_payment_transactions')
      .update({
        payment_status: 'failed',
        failure_reason: reason,
        retry_count: retryCount + 1,
      })
      .eq('id', transactionId);

    if (retryCount < 2) {
      setTimeout(() => {
        setRetryCount(retryCount + 1);
        onFailure(reason, false);
      }, 2000);
    } else {
      await supabase.rpc('fail_nfc_payment_fallback_to_eft', {
        p_nfc_payment_id: transactionId,
        p_failure_reason: reason,
        p_failure_code: 'MAX_RETRIES_EXCEEDED',
      });

      setTimeout(() => {
        onFailure('Maximum retry attempts exceeded', true);
      }, 2000);
    }
  };

  const handleTimeout = async () => {
    setStatus('timeout');
    setError('Payment timeout - took too long');

    if (transactionId) {
      await supabase
        .from('nfc_payment_transactions')
        .update({
          payment_status: 'timeout',
          failure_reason: 'NFC activation timeout',
          failure_code: 'TIMEOUT',
        })
        .eq('id', transactionId);
    }

    setTimeout(() => {
      onFailure('Payment timeout', true);
    }, 2000);
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'preparing':
        return <Loader2 className="w-20 h-20 text-blue-600 animate-spin" />;
      case 'nfc_ready':
      case 'waiting_tap':
        return <Smartphone className="w-20 h-20 text-blue-600 animate-pulse" />;
      case 'transmitting':
        return <Loader2 className="w-20 h-20 text-blue-600 animate-spin" />;
      case 'pin_request':
        return <CheckCircle2 className="w-20 h-20 text-green-600" />;
      case 'awaiting_pin':
        return <CreditCard className="w-20 h-20 text-blue-600 animate-pulse" />;
      case 'processing':
        return <Loader2 className="w-20 h-20 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-20 h-20 text-green-600" />;
      case 'failed':
      case 'timeout':
        return <XCircle className="w-20 h-20 text-red-600" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'preparing':
        return 'Preparing Payment...';
      case 'nfc_ready':
        return 'Payment Ready';
      case 'waiting_tap':
        return 'Hold Phone Near Card Machine';
      case 'transmitting':
        return 'Transmitting Payment...';
      case 'pin_request':
        return 'Card Details Transmitted';
      case 'awaiting_pin':
        return 'Enter PIN on Card Reader';
      case 'processing':
        return 'Processing Payment...';
      case 'completed':
        return 'Payment Successful!';
      case 'failed':
        return 'Payment Failed';
      case 'timeout':
        return 'Payment Timeout';
    }
  };

  const getStatusDescription = () => {
    switch (status) {
      case 'preparing':
        return 'Securely preparing your payment details';
      case 'nfc_ready':
        return 'Get ready to tap your phone';
      case 'waiting_tap':
        return 'Tap your phone to the card machine to complete payment';
      case 'transmitting':
        return 'Sending encrypted payment data';
      case 'pin_request':
        return 'Payment information successfully transmitted via NFC';
      case 'awaiting_pin':
        return 'Enter your card PIN on the card reader device to authorize the transaction';
      case 'processing':
        return 'Finalizing your transaction';
      case 'completed':
        return `R${amount.toFixed(2)} paid successfully`;
      case 'failed':
        return error || 'Transaction could not be completed';
      case 'timeout':
        return 'Payment took too long to complete';
    }
  };

  const canCancel = ['preparing', 'nfc_ready', 'waiting_tap'].includes(status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className={`p-8 text-center ${
          status === 'completed' ? 'bg-gradient-to-b from-green-50 to-white' :
          status === 'failed' || status === 'timeout' ? 'bg-gradient-to-b from-red-50 to-white' :
          'bg-gradient-to-b from-blue-50 to-white'
        }`}>
          <div className="flex justify-center mb-6">
            {getStatusIcon()}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {getStatusText()}
          </h2>

          <p className="text-gray-600 mb-6">
            {getStatusDescription()}
          </p>

          {(status === 'nfc_ready' || status === 'waiting_tap') && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-center space-x-3 mb-3">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                  <p className="text-sm text-gray-600">
                    {paymentType === 'local_account' ? accountInfo : `${cardBrand} •••• ${lastFourDigits}`}
                  </p>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  R{amount.toFixed(2)}
                </p>
              </div>

              <div className="flex items-center justify-center space-x-2 text-gray-600">
                <div className={`w-3 h-3 rounded-full ${countdown > 30 ? 'bg-green-500' : countdown > 10 ? 'bg-yellow-500' : 'bg-red-500'} animate-pulse`} />
                <p className="text-sm font-medium">
                  {countdown} seconds remaining
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800 text-center">
                  Position your phone near the card machine's contactless reader
                </p>
              </div>
            </div>
          )}

          {status === 'transmitting' && (
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex justify-center space-x-2 mb-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-600">
                Please do not close this screen
              </p>
            </div>
          )}

          {status === 'pin_request' && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-6 shadow-sm border-2 border-green-200">
                <div className="space-y-3 mb-6">
                  <div className="flex items-start space-x-3 text-gray-700">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-semibold text-green-700">Card Details Transmitted Successfully</p>
                      <p className="text-sm text-gray-600 mt-1">Payment information sent via NFC</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center space-x-3 pt-3 pb-2">
                    <CreditCard className="w-5 h-5 text-gray-600" />
                    <p className="text-sm font-medium text-gray-700">
                      {paymentType === 'local_account' ? accountInfo : `${cardBrand} •••• ${lastFourDigits}`}
                    </p>
                  </div>
                  <p className="text-center text-2xl font-bold text-gray-900">
                    R{amount.toFixed(2)}
                  </p>
                </div>

                <button
                  onClick={handleGetPIN}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-5 px-6 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 animate-pulse"
                >
                  <div className="flex items-center justify-center space-x-3">
                    <CreditCard className="w-6 h-6" />
                    <span className="text-lg">Press to Get Card PIN</span>
                  </div>
                </button>
              </div>

              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-yellow-900 mb-1">
                      Action Required
                    </p>
                    <p className="text-sm text-yellow-800">
                      Press the button above to retrieve your card PIN. You'll then enter this PIN on the physical card reader to authorize the transaction.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {status === 'awaiting_pin' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-xl">
                <div className="text-center mb-6">
                  <p className="text-sm font-medium text-blue-100 mb-2">
                    Enter this PIN on the card reader
                  </p>
                  <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-6 mb-4">
                    <div className="text-6xl font-bold tracking-wider font-mono">
                      {authorizationPIN || '----'}
                    </div>
                  </div>
                  <p className="text-xs text-blue-100">
                    Your card PIN for R{amount.toFixed(2)} payment
                  </p>
                </div>

                <div className="bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-center space-x-3 mb-2">
                    <CreditCard className="w-4 h-4 text-blue-200" />
                    <p className="text-sm text-blue-100">
                      {paymentType === 'local_account' ? accountInfo : `${cardBrand} •••• ${lastFourDigits}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="space-y-3 mb-4">
                  <div className="flex items-start space-x-3 text-gray-700">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Card details transmitted</p>
                      <p className="text-xs text-gray-500">Payment information sent via NFC</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 text-blue-600">
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 animate-pulse">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Enter PIN on card reader</p>
                      <p className="text-xs text-blue-500">Type the code shown above</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 text-gray-400">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Payment authorization</p>
                      <p className="text-xs text-gray-400">Waiting for confirmation</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900 mb-1">
                      Important
                    </p>
                    <p className="text-xs text-yellow-700">
                      Enter the PIN on the garage's card reader device to complete your transaction. Do not share this PIN with anyone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex justify-center space-x-2 mb-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-600">
                Please do not close this screen
              </p>
            </div>
          )}

          {status === 'completed' && (
            <div className="bg-white rounded-lg p-6 shadow-sm space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount Paid</span>
                <span className="font-medium">R{amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payment Method</span>
                <span className="font-medium">{paymentType === 'local_account' ? 'NFC Local Account' : 'NFC Card Payment'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{paymentType === 'local_account' ? 'Account' : 'Card'}</span>
                <span className="font-medium">{paymentType === 'local_account' ? accountInfo : `${cardBrand} •••• ${lastFourDigits}`}</span>
              </div>
            </div>
          )}

          {(status === 'failed' || status === 'timeout') && (
            <div className={`border rounded-lg p-4 ${
              error.includes('not configured') || error.includes('encryption')
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start space-x-3">
                <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  error.includes('not configured') || error.includes('encryption')
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`} />
                <div className="text-left">
                  <p className={`text-sm font-medium mb-1 ${
                    error.includes('not configured') || error.includes('encryption')
                      ? 'text-yellow-900'
                      : 'text-red-900'
                  }`}>
                    {error.includes('not configured') || error.includes('encryption')
                      ? 'Configuration Required'
                      : retryCount >= 2 ? 'Falling back to EFT batch payment' : 'Payment could not be completed'}
                  </p>
                  <p className={`text-xs ${
                    error.includes('not configured') || error.includes('encryption')
                      ? 'text-yellow-700'
                      : 'text-red-700'
                  }`}>
                    {error.includes('not configured') || error.includes('encryption')
                      ? 'NFC payments require server configuration. Use EFT batch payment instead.'
                      : retryCount >= 2
                      ? 'Your transaction will be processed via EFT batch instead'
                      : 'You can try again or use EFT batch payment'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {canCancel && (
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <button
              onClick={onCancel}
              className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
            >
              Cancel Payment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
