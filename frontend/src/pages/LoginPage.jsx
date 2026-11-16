import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Lock, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col justify-between bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-150">
      {/* Top Header */}
      <header className="border-b border-[var(--border-color)] px-4 sm:px-8 py-3.5 flex items-center justify-between bg-[var(--bg-header)]">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs font-mono shrink-0 bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]">
            ED
          </div>
          <div>
            <span className="font-bold text-xs sm:text-sm tracking-tight text-[var(--text-primary)] block font-sans">
              ENTERPRISE DMS
            </span>
            <span className="text-[10px] font-mono tracking-wider text-[var(--text-muted)] block uppercase">
              DOCUMENT MANAGEMENT PLATFORM
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-xs font-mono hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
            <span>SIEMENS DOConCD COMPLIANT</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Login Card */}
      <div className="flex-1 flex items-center justify-center p-3.5 sm:p-6 my-auto page-enter">
        <div className="max-w-md w-full dms-card p-6 sm:p-8">
          {/* Logo & Headline */}
          <div className="mb-6 text-center">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center mx-auto mb-3 bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Document Management SaaS
            </h1>
            <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              Authorized access to technical specifications, SINUMERIK / SINAMICS archives, and engineering documentation.
            </p>
          </div>

          {/* Success Notification */}
          {resetSuccess && (
            <div className="mb-5 p-3 rounded-md border border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)] text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Password updated successfully. You can now sign in with your new credentials.</span>
            </div>
          )}

          {/* Error Notification */}
          {error && (
            <div className="mb-5 p-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)] text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Authentication Form: Email and Password */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                autoComplete="email"
                className="dms-input"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-[var(--primary-blue)] hover:underline transition-colors font-medium"
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
                  className="dms-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="dms-btn-primary w-full py-2.5 text-xs font-semibold uppercase tracking-wider"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border-color)]" />
            </div>
            <span className="relative px-3 text-[11px] uppercase tracking-wider font-mono bg-[var(--bg-card)] text-[var(--text-muted)]">
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
      <footer className="border-t border-[var(--border-color)] px-4 sm:px-8 py-3.5 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-header)]">
        Enterprise Document Management System • ISO 27001 & DOConCD Compliant
      </footer>
    </div>
  );
}
