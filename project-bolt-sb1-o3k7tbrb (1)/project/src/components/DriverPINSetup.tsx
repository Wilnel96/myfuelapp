import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DriverPINSetupProps {
  driverId: string;
  onComplete: () => void;
  onCancel?: () => void;
}

export function DriverPINSetup({ driverId, onComplete, onCancel }: DriverPINSetupProps) {
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [oldPin, setOldPin] = useState('');

  useEffect(() => {
    checkExistingPIN();
  }, [driverId]);

  const checkExistingPIN = async () => {
    try {
      const { data } = await supabase
        .from('driver_payment_settings')
        .select('is_pin_active')
        .eq('driver_id', driverId)
        .maybeSingle();

      if (data?.is_pin_active) {
        setIsChanging(true);
      }
    } catch (err) {
      console.error('Error checking PIN:', err);
    }
  };

  const validatePIN = (pinValue: string): string | null => {
    if (pinValue.length !== 4) {
      return 'PIN must be exactly 4 digits';
    }

    if (!/^\d{4}$/.test(pinValue)) {
      return 'PIN must contain only numbers';
    }

    if (/^(\d)\1{3}$/.test(pinValue)) {
      return 'PIN cannot be all same digits (e.g., 1111)';
    }

    if (pinValue === '1234' || pinValue === '4321') {
      return 'PIN cannot be sequential (e.g., 1234, 4321)';
    }

    if (/^(\d{2})\1$/.test(pinValue)) {
      return 'PIN cannot be repeating pattern (e.g., 1212)';
    }

    return null;
  };

  const handleNumberClick = (num: string) => {
    setError('');

    if (isChanging && step === 'enter' && oldPin.length === 0) {
      if (oldPin.length < 4) {
        const newOldPin = oldPin + num;
        setOldPin(newOldPin);

        if (newOldPin.length === 4) {
          setTimeout(() => setStep('enter'), 100);
        }
      }
    } else if (step === 'enter') {
      if (pin.length < 4) {
        const newPin = pin + num;
        setPin(newPin);

        if (newPin.length === 4) {
          const validationError = validatePIN(newPin);
          if (validationError) {
            setError(validationError);
            setTimeout(() => {
              setPin('');
            }, 1000);
          } else {
            setTimeout(() => setStep('confirm'), 300);
          }
        }
      }
    } else if (step === 'confirm') {
      if (confirmPin.length < 4) {
        const newConfirmPin = confirmPin + num;
        setConfirmPin(newConfirmPin);

        if (newConfirmPin.length === 4) {
          if (newConfirmPin !== pin) {
            setError('PINs do not match');
            setTimeout(() => {
              setConfirmPin('');
              setPin('');
              setStep('enter');
            }, 1000);
          } else {
            handleSubmit(pin);
          }
        }
      }
    }
  };

  const handleBackspace = () => {
    setError('');

    if (isChanging && step === 'enter' && oldPin.length === 0) {
      setOldPin(oldPin.slice(0, -1));
    } else if (step === 'enter') {
      setPin(pin.slice(0, -1));
    } else if (step === 'confirm') {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const handleClear = () => {
    setError('');

    if (isChanging && step === 'enter' && oldPin.length === 0) {
      setOldPin('');
    } else if (step === 'enter') {
      setPin('');
    } else if (step === 'confirm') {
      setConfirmPin('');
    }
  };

  const handleSubmit = async (finalPin: string) => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-driver-pin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            driverId,
            pin: finalPin,
            oldPin: isChanging ? oldPin : undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to set PIN');
      }

      console.log('[DriverPINSetup] ✅ PIN set successfully, calling onComplete()');
      onComplete();
      console.log('[DriverPINSetup] onComplete() called');
    } catch (err: any) {
      setError(err.message || 'Failed to set PIN');
      setPin('');
      setConfirmPin('');
      setOldPin('');
      setStep('enter');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPin = () => {
    if (isChanging && oldPin.length < 4) return oldPin;
    if (step === 'enter') return pin;
    return confirmPin;
  };

  const getTitle = () => {
    if (isChanging && oldPin.length < 4) return 'Enter Current PIN';
    if (step === 'enter') return isChanging ? 'Enter New 4-Digit PIN' : 'Create 4-Digit PIN';
    return 'Confirm Your PIN';
  };

  const getSubtitle = () => {
    if (isChanging && oldPin.length < 4) return 'Verify your current PIN first';
    if (step === 'enter') return 'Choose a secure 4-digit PIN for payments';
    return 'Re-enter your PIN to confirm';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{getTitle()}</h2>
          <p className="mt-2 text-gray-600">{getSubtitle()}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="flex justify-center space-x-4">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${
                  getCurrentPin().length > index
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {getCurrentPin().length > index && (
                  <div className="w-4 h-4 bg-white rounded-full" />
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                disabled={loading}
                className="aspect-square rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-2xl font-semibold text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              disabled={loading}
              className="aspect-square rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-sm font-medium text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
            <button
              onClick={() => handleNumberClick('0')}
              disabled={loading}
              className="aspect-square rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-2xl font-semibold text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              disabled={loading}
              className="aspect-square rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-sm font-medium text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ⌫
            </button>
          </div>

          {loading && (
            <div className="text-center text-gray-600">
              <p>Setting up your PIN...</p>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-medium mb-2">Security Tips:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Avoid using obvious PINs like 1234</li>
            <li>Do not use all same digits like 1111</li>
            <li>Keep your PIN confidential</li>
            <li>Account locks after 3 failed attempts</li>
          </ul>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Cancel</span>
          </button>
        )}
      </div>
    </div>
  );
}
