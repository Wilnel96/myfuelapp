import { useState, useRef, useEffect } from 'react';
import { Fuel, AlertCircle, ArrowLeft, Download, Smartphone, X } from 'lucide-react';

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
  requireLicenseScan?: boolean;
}

export default function DriverAuth({ onLogin, onBack }: DriverAuthProps) {
  const [firstName, setFirstName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);

  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if already installed as PWA
    const installed = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsInstalled(installed);

    // Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // Listen for Chrome/Android install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      if (!installed) setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Show iOS banner if on iOS and not installed and not dismissed
    if (ios && !installed && !sessionStorage.getItem('installBannerDismissed')) {
      setShowInstallBanner(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallBanner(false);
        setInstallPrompt(null);
      }
    }
  };

  const dismissBanner = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('installBannerDismissed', '1');
  };

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
          rememberMe: stayLoggedIn,
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

        {/* Install banner */}
        {showInstallBanner && !isInstalled && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-900">Install MyFuelApp</p>
                {isIOS ? (
                  <p className="text-xs text-blue-700 mt-0.5">
                    Tap the <strong>Share</strong> button in Safari, then <strong>"Add to Home Screen"</strong> to install.
                  </p>
                ) : (
                  <p className="text-xs text-blue-700 mt-0.5">
                    Install the app on your phone for quick one-tap access.
                  </p>
                )}
                {!isIOS && installPrompt && (
                  <button
                    onClick={handleInstall}
                    className="mt-2 flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Install App
                  </button>
                )}
              </div>
              <button onClick={dismissBanner} className="text-blue-400 hover:text-blue-600 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

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

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={stayLoggedIn}
              onChange={(e) => setStayLoggedIn(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Stay logged in</span>
          </label>

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
