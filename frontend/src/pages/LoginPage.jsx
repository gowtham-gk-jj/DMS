import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

export default function LoginPage() {
  const { loginWithEmail, loginWithGoogle, user, isApproved } = useAuth();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetSuccess = searchParams.get('reset') === 'success';

  // Redirect if already authenticated
  React.useEffect(() => {
    if (user) {
      if (isApproved) {
        navigate('/dashboard');
      } else {
        navigate('/pending-approval');
      }
    }
  }, [user, isApproved, navigate]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both your email address and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const loggedUser = await loginWithEmail(email.trim(), password);
      if (loggedUser.status === 'APPROVED' || loggedUser.role === 'ADMIN') {
        navigate('/dashboard');
      } else {
        navigate('/pending-approval');
      }
    } catch (err) {
      console.error('Email sign-in error:', err);
      const msg = err.response?.data?.message || err.message || 'Invalid email or password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError('');
      const loggedUser = await loginWithGoogle(credentialResponse.credential);
      if (loggedUser.status === 'APPROVED' || loggedUser.role === 'ADMIN') {
        navigate('/dashboard');
      } else {
        navigate('/pending-approval');
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      const msg = err.response?.data?.message || err.message || 'Google authentication failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors duration-150 ${
        isDark ? 'bg-[#0b0f17] text-[#f8fafc]' : 'bg-[#ffffff] text-[#111111]'
      }`}
    >
      {/* Top Header */}
      <header
        className={`border-b px-4 sm:px-8 py-3.5 flex items-center justify-between ${
          isDark ? 'bg-[#0f172a] border-[#243042]' : 'bg-[#ffffff] border-[#e5e5e5]'
        }`}
      >
        <div className="flex items-center space-x-2.5">
          <div
            className={`w-7 h-7 flex items-center justify-center font-bold text-xs font-mono shrink-0 ${
              isDark ? 'bg-[#f8fafc] text-[#0b0f17]' : 'bg-[#111111] text-[#ffffff]'
            }`}
          >
            D
          </div>
          <span className="font-bold text-xs sm:text-sm tracking-tight uppercase">
            ENTERPRISE DMS PLATFORM
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <div
            className={`text-xs font-mono hidden md:block ${
              isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
            }`}
          >
            SIEMENS DOConCD COMPLIANT
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Login Card */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-6 my-auto">
        <div
          className={`max-w-md w-full border p-5 sm:p-8 shadow-sm transition-colors duration-150 ${
            isDark
              ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
              : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
          }`}
        >
          {/* Logo & Headline */}
          <div className="mb-6 text-center">
            <div
              className={`w-12 h-12 flex items-center justify-center mx-auto mb-3 ${
                isDark ? 'bg-[#1e293b] text-[#60a5fa] border border-[#334155]' : 'bg-[#111111] text-[#ffffff]'
              }`}
            >
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              Document Management SaaS
            </h1>
            <p className={`text-xs mt-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
              Authorized access to technical manuals, SINUMERIK / SINAMICS archives, and engineering repositories.
            </p>
          </div>

          {/* Success Notification */}
          {resetSuccess && (
            <div
              className={`mb-5 p-3 border text-xs flex items-center space-x-2 ${
                isDark
                  ? 'bg-[#064e3b] border-[#047857] text-[#a7f3d0]'
                  : 'bg-[#fafafa] border-[#111111] text-[#111111]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Password updated successfully. You can now sign in.</span>
            </div>
          )}

          {/* Error Notification */}
          {error && (
            <div
              className={`mb-5 p-3 border text-xs flex items-center space-x-2 ${
                isDark
                  ? 'bg-[#451a1a] border-[#b91c1c] text-[#fca5a5]'
                  : 'bg-[#fafafa] border-[#111111] text-[#111111]'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Authentication Form A: Email and Password */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label
                className={`block text-xs font-medium mb-1.5 uppercase tracking-wider ${
                  isDark ? 'text-[#cbd5e1]' : 'text-[#111111]'
                }`}
              >
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  autoComplete="email"
                  className={`w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-[38px] text-xs border rounded-none focus:outline-none transition-colors ${
                    isDark
                      ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                      : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
                  }`}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label
                  className={`block text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-[#cbd5e1]' : 'text-[#111111]'
                  }`}
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className={`text-[11px] underline transition-colors ${
                    isDark ? 'text-[#94a3b8] hover:text-[#f8fafc]' : 'text-[#777777] hover:text-[#111111]'
                  }`}
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  required
                  autoComplete="current-password"
                  className={`w-full px-3 py-2.5 sm:py-2 pr-11 min-h-[44px] sm:min-h-[38px] text-xs border rounded-none focus:outline-none transition-colors ${
                    isDark
                      ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                      : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center transition-colors cursor-pointer ${
                    isDark ? 'text-[#94a3b8] hover:text-[#f8fafc]' : 'text-[#777777] hover:text-[#111111]'
                  }`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 min-h-[44px] text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer ${
                isDark
                  ? 'bg-[#f8fafc] text-[#0b0f17] hover:bg-[#e2e8f0]'
                  : 'bg-[#111111] text-[#ffffff] hover:bg-[#333333]'
              }`}
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div
                className={`w-full border-t ${
                  isDark ? 'border-[#243042]' : 'border-[#e5e5e5]'
                }`}
              ></div>
            </div>
            <span
              className={`relative px-3 text-[11px] uppercase tracking-wider font-mono ${
                isDark
                  ? 'bg-[#141c2b] text-[#94a3b8]'
                  : 'bg-[#ffffff] text-[#777777]'
              }`}
            >
              Or Continue With
            </span>
          </div>

          {/* Authentication Form B: Google OAuth */}
          <div className="flex justify-center w-full overflow-hidden">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Sign-In was cancelled or failed.')}
              useOneTap={false}
              theme={isDark ? 'filled_black' : 'outline'}
              size="large"
              shape="rectangular"
              text="continue_with"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className={`border-t px-4 sm:px-8 py-3.5 text-center text-xs ${
          isDark ? 'border-[#243042] text-[#94a3b8]' : 'border-[#e5e5e5] text-[#777777]'
        }`}
      >
        Enterprise Document Management System • ISO 27001 & DOConCD Compliant
      </footer>
    </div>
  );
}
