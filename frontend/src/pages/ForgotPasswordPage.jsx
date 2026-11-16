import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

export default function ForgotPasswordPage() {
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide your email address.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
    } catch (err) {
      console.error('Forgot password error:', err);
      if (err.response?.status === 429) {
        setError('Too many requests. Please try again after 15 minutes.');
      } else {
        setSubmitted(true);
      }
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
            PASSWORD RECOVERY
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Card */}
      <div className="flex-1 flex items-center justify-center p-3.5 sm:p-6 my-auto page-enter">
        <div className="max-w-md w-full dms-card p-6 sm:p-8">
          <div className="mb-6 text-center">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center mx-auto mb-3 bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]">
              <Mail className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Reset Account Password
            </h1>
            <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              Enter your registered corporate email to receive a secure, single-use password reset link.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)] text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {submitted ? (
            <div className="space-y-5">
              <div className="p-4 rounded-md border border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-xs space-y-2">
                <div className="flex items-center space-x-2 font-semibold text-[var(--color-success-text)]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Request Dispatched</span>
                </div>
                <p className="leading-relaxed text-[var(--text-secondary)]">
                  If an account exists with that email address, a password reset link has been dispatched. Please check your inbox and spam folder.
                </p>
                <p className="text-[11px] font-mono text-[var(--text-muted)]">
                  • Link validity: 1 hour<br />
                  • Single-use cryptographically signed token
                </p>
              </div>

              <Link
                to="/login"
                className="dms-btn-secondary w-full py-2.5 text-xs font-semibold uppercase tracking-wider"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                  Account Email Address
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

              <button
                type="submit"
                disabled={loading}
                className="dms-btn-primary w-full py-2.5 text-xs font-semibold uppercase tracking-wider"
              >
                <span>{loading ? 'Dispatching...' : 'Send Password Reset Link'}</span>
                {!loading && <ArrowRight className="w-3.5 h-3.5" />}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="text-xs inline-flex items-center space-x-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color)] px-4 sm:px-8 py-3.5 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-header)]">
        Enterprise Document Management System • ISO 27001 & DOConCD Compliant
      </footer>
    </div>
  );
}
