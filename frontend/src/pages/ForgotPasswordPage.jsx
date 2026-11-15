import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
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
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors duration-150 ${
        isDark ? 'bg-[#0b0f17] text-[#f8fafc]' : 'bg-[#ffffff] text-[#111111]'
      }`}
    >
      {/* Header */}
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
            className={`text-xs font-mono hidden sm:block ${
              isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
            }`}
          >
            PASSWORD RECOVERY
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Card */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-6 my-auto">
        <div
          className={`max-w-md w-full border p-5 sm:p-8 shadow-sm transition-colors duration-150 ${
            isDark
              ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
              : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
          }`}
        >
          <div className="mb-6 text-center">
            <div
              className={`w-12 h-12 flex items-center justify-center mx-auto mb-3 ${
                isDark ? 'bg-[#1e293b] text-[#60a5fa] border border-[#334155]' : 'bg-[#111111] text-[#ffffff]'
              }`}
            >
              <Mail className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              Reset Account Password
            </h1>
            <p className={`text-xs mt-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
              Enter the email address registered with your DMS account to receive a secure, single-use password reset link.
            </p>
          </div>

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

          {submitted ? (
            <div className="space-y-5">
              <div
                className={`p-4 border text-xs space-y-2 ${
                  isDark
                    ? 'bg-[#0f172a] border-[#243042] text-[#cbd5e1]'
                    : 'bg-[#fafafa] border-[#111111] text-[#111111]'
                }`}
              >
                <div className="flex items-center space-x-2 font-semibold">
                  <CheckCircle2 className={`w-4 h-4 ${isDark ? 'text-[#34d399]' : 'text-[#111111]'}`} />
                  <span>Request Dispatched</span>
                </div>
                <p className={`leading-relaxed ${isDark ? 'text-[#94a3b8]' : 'text-[#666666]'}`}>
                  If an account exists with that email address, a password reset link has been dispatched. Please check your inbox and spam folder.
                </p>
                <p className={`text-[11px] ${isDark ? 'text-[#64748b]' : 'text-[#888888]'}`}>
                  • Link validity: 1 hour<br />
                  • Single-use expiring token
                </p>
              </div>

              <Link
                to="/login"
                className={`w-full py-2.5 border text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center space-x-2 ${
                  isDark
                    ? 'border-[#334155] text-[#f8fafc] hover:bg-[#1e293b]'
                    : 'border-[#111111] text-[#111111] hover:bg-[#f5f5f5]'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  className={`block text-xs font-medium mb-1.5 uppercase tracking-wider ${
                    isDark ? 'text-[#cbd5e1]' : 'text-[#111111]'
                  }`}
                >
                  Account Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  autoComplete="email"
                  className={`w-full px-3 py-2 text-xs border rounded-none focus:outline-none transition-colors ${
                    isDark
                      ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                      : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer ${
                  isDark
                    ? 'bg-[#f8fafc] text-[#0b0f17] hover:bg-[#e2e8f0]'
                    : 'bg-[#111111] text-[#ffffff] hover:bg-[#333333]'
                }`}
              >
                <span>{loading ? 'Dispatching...' : 'Send Password Reset Link'}</span>
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className={`text-xs inline-flex items-center space-x-1.5 underline ${
                    isDark ? 'text-[#94a3b8] hover:text-[#f8fafc]' : 'text-[#777777] hover:text-[#111111]'
                  }`}
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
