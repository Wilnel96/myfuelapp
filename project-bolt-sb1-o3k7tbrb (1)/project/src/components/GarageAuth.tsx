import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, ArrowLeft, Store } from 'lucide-react';

interface GarageAuthProps {
  onLogin: (garageId: string, garageName: string, garageEmail: string, garagePassword: string) => void;
  onBack?: () => void;
  onSignup?: () => void;
}

export default function GarageAuth({ onLogin, onBack, onSignup }: GarageAuthProps) {
  const [contactEmail, setContactEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('[GarageAuth] Attempting login with email:', contactEmail);

      // Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: contactEmail.trim().toLowerCase(),
        password: password
      });

      if (authError) {
        console.error('[GarageAuth] Auth error:', authError);
        setError('Invalid email or password');
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Login failed. Please try again.');
        setLoading(false);
        return;
      }

      console.log('[GarageAuth] Login successful, verifying garage access...');

      // Verify the user is a garage user by checking organization_users table
      const { data: orgUser, error: orgUserError } = await supabase
        .from('organization_users')
        .select('role')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (orgUserError) {
        console.error('[GarageAuth] Organization user error:', orgUserError);
        await supabase.auth.signOut();
        setError('Could not verify account. Please contact support.');
        setLoading(false);
        return;
      }

      if (!orgUser || orgUser.role !== 'garage_user') {
        console.error('[GarageAuth] User is not a garage user:', orgUser?.role);
        await supabase.auth.signOut();
        setError('This account does not have access to the garage portal.');
        setLoading(false);
        return;
      }

      console.log('[GarageAuth] Garage user verified, auth state listener will handle routing');
      // The auth state listener in App.tsx will detect the garage_user role
      // and automatically route to the garage portal
    } catch (err: any) {
      console.error('[GarageAuth] Login error:', err);
      setError(err.message || 'An error occurred during login');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-blue-600 text-white p-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Store className="w-10 h-10" />
            <h1 className="text-2xl font-bold">MyFuelApp</h1>
          </div>
          <p className="text-blue-100 text-sm">Garage Portal</p>
        </div>

        <div className="p-8">
        {onBack && (
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login Selection
          </button>
        )}
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-xl font-bold text-gray-900">Garage Sign In</h1>
          <p className="text-gray-600 mt-2 text-center">
            Sign in to manage your local client accounts and your garage information
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Email
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your.email@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          {onSignup && (
            <button
              type="button"
              onClick={onSignup}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium transition-colors"
            >
              Sign Up - Don't have an account? Register your garage
            </button>
          )}
          <p className="text-sm text-gray-600">
            Need help? Contact your system administrator
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
