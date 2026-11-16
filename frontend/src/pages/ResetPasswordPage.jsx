import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import api from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post(`/auth/reset-password/${token}`, { password });
      if (res.data.success) {
        navigate('/login?reset=success');
      }
    } catch (err) {
      console.error('Password reset failure:', err);
      const msg = err.response?.data?.message || 'Password reset link is invalid or has expired.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-150">
      {/* Header */}
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
          <div className="text-xs font-mono hidden sm:block text-[var(--text-secondary)]">
            SECURE CREDENTIAL SETUP
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Card */}
      <div className="flex-1 flex items-center justify-center p-3.5 sm:p-6 my-auto page-enter">
        <div className="max-w-md w-full dms-card p-6 sm:p-8">
          <div className="mb-6 text-center">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center mx-auto mb-3 bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Set New Password
            </h1>
            <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              Create a strong password for your Document Management System account.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)] text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                New Password (Min 8 Characters)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new secure password"
                  required
                  minLength={8}
                  className="dms-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new secure password"
                required
                minLength={8}
                className="dms-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="dms-btn-primary w-full py-2.5 text-xs font-semibold uppercase tracking-wider"
            >
              <span>{loading ? 'Saving Password...' : 'Save New Password'}</span>
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="text-xs inline-flex items-center space-x-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color)] px-4 sm:px-8 py-3.5 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-header)]">
        Enterprise Document Management System • ISO 27001 & DOConCD Compliant
      </footer>
    </div>
  );
}
