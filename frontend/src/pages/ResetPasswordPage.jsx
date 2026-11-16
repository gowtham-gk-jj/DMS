import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();

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
            SECURE CREDENTIAL SETUP
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
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              Set New Password
            </h1>
            <p className={`text-xs mt-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
              Create a strong password for your Document Management System account.
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className={`block text-xs font-medium mb-1.5 uppercase tracking-wider ${
                  isDark ? 'text-[#cbd5e1]' : 'text-[#111111]'
                }`}
              >
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
                  className={`w-full px-3 py-2.5 sm:py-2 pr-11 min-h-[44px] sm:min-h-[38px] text-xs border rounded-none focus:outline-none transition-colors ${
                    isDark
                      ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                      : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center transition-colors cursor-pointer ${
                    isDark ? 'text-[#94a3b8] hover:text-[#f8fafc]' : 'text-[#777777] hover:text-[#111111]'
                  }`}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                className={`block text-xs font-medium mb-1.5 uppercase tracking-wider ${
                  isDark ? 'text-[#cbd5e1]' : 'text-[#111111]'
                }`}
              >
                Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new secure password"
                required
                minLength={8}
                className={`w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-[38px] text-xs border rounded-none focus:outline-none transition-colors ${
                  isDark
                    ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                    : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
                }`}
              />
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
              <span>{loading ? 'Saving Password...' : 'Save New Password'}</span>
            </button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className={`text-xs inline-flex items-center space-x-1.5 underline ${
                  isDark ? 'text-[#94a3b8] hover:text-[#f8fafc]' : 'text-[#777777] hover:text-[#111111]'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </Link>
            </div>
          </form>
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
