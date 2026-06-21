import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Fuel, AlertCircle, ArrowLeft } from 'lucide-react';

interface AuthProps {
  onBack?: () => void;
  onSignup?: () => void;
  onPasswordReset?: () => void;
  portalError?: string;
  portalLabel?: string;
}

export default function Auth({ onBack, onSignup, onPasswordReset, portalError, portalLabel }: AuthProps = {}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('[Auth] Attempting login with email:', email);
      console.log('[Auth] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Auth] Login error:', error);
        throw error;
      }

      if (!data.session) {
        throw new Error('Login failed — no session returned. Please try again.');
      }

      // Clear any stale flags
      localStorage.removeItem('pendingGarageLogin');

      // onAuthStateChange in App.tsx fires SIGNED_IN and handles navigation.
      // Keep loading=true so the button stays disabled until the component unmounts.
      // If the component somehow stays mounted (e.g. RLS blocks profile load),
      // the 10-second emergency timeout in App.tsx will recover.
      // Nothing more to do here — do NOT call setLoading(false).

    } catch (err: any) {
      console.error('[Auth] Auth error:', err);
      setError(err.message || 'Authentication failed');
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
          <p className="text-blue-100 text-sm">{portalLabel ?? 'Mobile Fuel Management'}</p>
        </div>

        <form onSubmit={handleAuth} className="p-6 space-y-4">
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
            Sign In
          </h2>

          {portalError && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-900 text-sm font-semibold mb-0.5">Access Denied</p>
                <p className="text-red-800 text-sm">{portalError}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="user@company.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Please wait...' : 'Sign In'}
          </button>

          {onPasswordReset && (
            <div className="text-center">
              <button
                type="button"
                onClick={onPasswordReset}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {onSignup && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-center text-sm text-gray-600 mb-3">
                Don't have an account?
              </p>
              <button
                type="button"
                onClick={onSignup}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Create your Account
              </button>
            </div>
          )}

          {!onSignup && (
            <div className="text-center text-sm text-gray-600 mt-4">
              <p>Need an Account?</p>
              <p className="text-xs text-gray-500 mt-1">Go to the Login Selection to create your account</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
