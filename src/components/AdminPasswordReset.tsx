import { useState } from 'react';
import { KeyRound, Mail, Lock, CheckCircle, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function AdminPasswordReset() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 fields
  const [tempPassword, setTempPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request password reset');
      }

      if (data.email_sent === false) {
        setMessage({
          type: 'error',
          text: data.debug
            ? `Password was reset but the email could not be delivered (${data.debug}). Please contact your administrator for the temporary password.`
            : 'Password was reset but the email could not be delivered. Please contact your administrator for the temporary password.',
        });
      } else {
        setStep(2);
        setMessage({
          type: 'success',
          text: 'A temporary password has been sent to your email. Check your inbox (and spam folder) and enter it below with your new password.',
        });
      }
    } catch (error: any) {
      console.error('Password reset request error:', error);
      setMessage({ type: 'error', text: error.message || 'An error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return 'Password must be at least 8 characters long';
    if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
    if (!/\d/.test(pw)) return 'Password must contain at least one number';
    if (!/[!@#$%^&*]/.test(pw)) return 'Password must contain at least one special character (!@#$%^&*)';
    return null;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    const pwError = validatePassword(newPassword);
    if (pwError) {
      setMessage({ type: 'error', text: pwError });
      return;
    }

    setLoading(true);

    try {
      // Call the change-password edge function directly with email + temp password.
      // The function will authenticate with the temp password and set the new one
      // in a single operation — no need for a separate sign-in step that can
      // fail if the user accidentally used a temp password from an earlier reset.
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/change-password`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          currentPassword: tempPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      setMessage({
        type: 'success',
        text: 'Your password has been changed successfully! You can now sign in with your new password.',
      });

      // Reset to step 1 after a delay
      setTimeout(() => {
        setStep(1);
        setEmail('');
        setTempPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setMessage(null);
      }, 4000);

    } catch (error: any) {
      console.error('Change password error:', error);
      const errMsg = error.message || 'An error occurred';
      const enhancedMsg = errMsg.includes('incorrect')
        ? 'The temporary password is incorrect. This usually happens if you requested multiple password resets — each email contains a different password. Please use the password from the MOST RECENT email only.'
        : errMsg;
      setMessage({ type: 'error', text: enhancedMsg });
    } finally {
      setLoading(false);
    }
  };

  const passwordChecks = [
    { label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
    { label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
    { label: 'One lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
    { label: 'One number', test: (pw: string) => /\d/.test(pw) },
    { label: 'One special character (!@#$%^&*)', test: (pw: string) => /[!@#$%^&*]/.test(pw) },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-blue-100 p-3 rounded-full">
            <KeyRound className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
          {step === 1 ? 'Reset Password' : 'Set New Password'}
        </h1>
        <p className="text-center text-gray-600 mb-6">
          {step === 1
            ? 'Enter your email to receive a temporary password'
            : 'Enter your temporary password and choose a new password'}
        </p>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`h-2 w-16 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
          <div className={`h-2 w-16 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
        </div>

        {step === 1 && (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="user@company.com"
                  required
                />
              </div>
            </div>

            {message && (
              <div className={`flex items-start gap-2 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                )}
                <p className="text-sm">{message.text}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {loading ? 'Sending...' : 'Send Temporary Password'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temporary Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="From your email"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Choose a strong password"
                  required
                />
              </div>
            </div>

            {/* Password requirements checklist */}
            {newPassword.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-gray-500 mb-2">Password requirements:</p>
                {passwordChecks.map((check) => (
                  <div key={check.label} className="flex items-center gap-2">
                    {check.test(newPassword) ? (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-gray-300 flex-shrink-0" />
                    )}
                    <span className={`text-xs ${check.test(newPassword) ? 'text-green-600' : 'text-gray-500'}`}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Re-enter new password"
                  required
                />
              </div>
            </div>

            {message && (
              <div className={`flex items-start gap-2 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                )}
                <p className="text-sm">{message.text}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {loading ? 'Changing Password...' : 'Change Password'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setMessage(null);
                setTempPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 pt-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Use a different email
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-blue-600 hover:text-blue-700">
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
