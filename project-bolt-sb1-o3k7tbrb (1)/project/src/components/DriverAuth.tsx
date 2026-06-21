import { useState, useRef } from 'react';
import { Fuel, AlertCircle, ArrowLeft } from 'lucide-react';

interface DriverAuthProps {
  onLogin: (driverData: DriverData) => void;
  onBack: () => void;
}

export interface DriverData {
  id: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  token: string;
  hasPIN?: boolean;
}

export default function DriverAuth({ onLogin, onBack }: DriverAuthProps) {
  const [firstName, setFirstName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 2) {
      setDay(value);
      if (value.length === 2) {
        monthRef.current?.focus();
      }
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 2) {
      setMonth(value);
      if (value.length === 2) {
        yearRef.current?.focus();
      }
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 4) {
      setYear(value);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!day || !month || !year || day.length !== 2 || month.length !== 2 || year.length !== 4) {
      setError('Please enter a complete date of birth');
      setLoading(false);
      return;
    }

    const dateOfBirth = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/driver-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          dateOfBirth,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.success && data.token && data.driver) {
        localStorage.setItem('driverToken', data.token);
        localStorage.setItem('driverData', JSON.stringify(data.driver));
        onLogin({
          ...data.driver,
          token: data.token,
        });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid first name or date of birth');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-blue-600 text-white p-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Fuel className="w-10 h-10" />
            <h1 className="text-2xl font-bold">MyFuelApp</h1>
          </div>
          <p className="text-blue-100 text-sm">Driver Mobile App</p>
        </div>

        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login Selection
            </button>
          )}
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-6">
            Driver Login
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value.toUpperCase())}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your first name"
              required
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date of Birth
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={day}
                onChange={handleDayChange}
                className="w-20 border border-gray-300 rounded-lg px-4 py-3 text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="DD"
                required
                maxLength={2}
              />
              <span className="flex items-center text-gray-400">/</span>
              <input
                type="text"
                inputMode="numeric"
                ref={monthRef}
                value={month}
                onChange={handleMonthChange}
                className="w-20 border border-gray-300 rounded-lg px-4 py-3 text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="MM"
                required
                maxLength={2}
              />
              <span className="flex items-center text-gray-400">/</span>
              <input
                type="text"
                inputMode="numeric"
                ref={yearRef}
                value={year}
                onChange={handleYearChange}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="YYYY"
                required
                maxLength={4}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Please wait...' : 'Sign In'}
          </button>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-600 text-center">
              Drivers can only access the mobile fuel purchase screen.
              <br />
              Contact your administrator for login issues.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
