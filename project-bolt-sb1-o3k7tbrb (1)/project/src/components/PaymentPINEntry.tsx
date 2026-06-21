import React, { useState } from 'react';
import { Lock, AlertCircle, X } from 'lucide-react';

interface PaymentPINEntryProps {
  amount: number;
  onVerified: (pin: string) => void;
  onCancel: () => void;
  attemptsRemaining?: number;
}

export function PaymentPINEntry({ amount, onVerified, onCancel, attemptsRemaining = 3 }: PaymentPINEntryProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleNumberClick = (num: string) => {
    setError('');

    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);

      if (newPin.length === 4) {
        setTimeout(() => {
          onVerified(newPin);
        }, 200);
      }
    }
  };

  const handleBackspace = () => {
    setError('');
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setError('');
    setPin('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Enter Your PIN</h2>
                <p className="text-blue-100 text-sm">Authorize payment</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-white bg-opacity-10 rounded-lg p-4 text-center">
            <p className="text-sm text-blue-100 mb-1">Payment Amount</p>
            <p className="text-3xl font-bold">R{amount.toFixed(2)}</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {attemptsRemaining < 3 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800 text-center font-medium">
                {attemptsRemaining} {attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining
              </p>
            </div>
          )}

          <div className="flex justify-center space-x-3">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${
                  pin.length > index
                    ? 'border-blue-600 bg-blue-600 scale-110'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {pin.length > index && (
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                className="aspect-square rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-blue-100 active:scale-95 text-2xl font-semibold text-gray-900 transition-all shadow-sm hover:shadow"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              className="aspect-square rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 active:scale-95 text-sm font-medium text-gray-600 transition-all shadow-sm hover:shadow"
            >
              Clear
            </button>
            <button
              onClick={() => handleNumberClick('0')}
              className="aspect-square rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-blue-100 active:scale-95 text-2xl font-semibold text-gray-900 transition-all shadow-sm hover:shadow"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              className="aspect-square rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 active:scale-95 text-xl font-medium text-gray-600 transition-all shadow-sm hover:shadow"
            >
              ⌫
            </button>
          </div>

          <div className="text-center">
            <button
              onClick={onCancel}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              Cancel Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
