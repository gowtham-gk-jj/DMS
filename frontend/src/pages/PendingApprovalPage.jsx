import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';

export default function PendingApprovalPage() {
  const { user, refreshUser, logout } = useAuth();
  const { isDark } = useTheme();
  const [request, setRequest] = useState(null);
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  const fetchStatus = async () => {
    try {
      setChecking(true);
      const [reqRes, updatedUser] = await Promise.all([
        api.get('/requests/my').catch(() => ({ data: { success: false } })),
        refreshUser(),
      ]);

      if (reqRes.data && reqRes.data.success && reqRes.data.request) {
        setRequest(reqRes.data.request);
      }

      const activeStatus = updatedUser?.status || user?.status;
      const isAdmin = updatedUser?.role === 'ADMIN' || user?.role === 'ADMIN';

      if (activeStatus === 'APPROVED' || isAdmin) {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Failed to fetch request status:', err);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const currentStatus = user?.status || request?.status || 'PENDING';

  const getStatusConfig = () => {
    switch (currentStatus) {
      case 'APPROVED':
        return {
          icon: <CheckCircle2 className={`w-8 h-8 ${isDark ? 'text-[#34d399]' : 'text-[#111111]'}`} />,
          title: 'Access Approved',
          badge: 'APPROVED',
          badgeBg: isDark ? 'bg-[#064e3b] text-[#a7f3d0] border border-[#047857]' : 'bg-[#111111] text-[#ffffff]',
          message: 'Your access has been approved. You can now access your authorized document library.',
        };
      case 'REJECTED':
        return {
          icon: <XCircle className={`w-8 h-8 ${isDark ? 'text-[#f87171]' : 'text-[#111111]'}`} />,
          title: 'Access Request Rejected',
          badge: 'REJECTED',
          badgeBg: isDark ? 'bg-[#451a1a] border border-[#b91c1c] text-[#fca5a5]' : 'bg-[#fafafa] border border-[#111111] text-[#111111]',
          message: 'Your access request was rejected. Contact an administrator for assistance.',
        };
      case 'SUSPENDED':
        return {
          icon: <AlertTriangle className={`w-8 h-8 ${isDark ? 'text-[#fbbf24]' : 'text-[#111111]'}`} />,
          title: 'Account Suspended',
          badge: 'SUSPENDED',
          badgeBg: isDark ? 'bg-[#451a1a] border border-[#b91c1c] text-[#fca5a5]' : 'bg-[#fafafa] border border-[#111111] text-[#111111]',
          message: 'Your account is currently suspended.',
        };
      case 'PENDING':
      default:
        return {
          icon: <Clock className={`w-8 h-8 ${isDark ? 'text-[#60a5fa]' : 'text-[#111111]'}`} />,
          title: 'Access Request Pending',
          badge: 'PENDING',
          badgeBg: isDark ? 'bg-[#1e293b] border border-[#334155] text-[#f8fafc]' : 'bg-[#ffffff] border border-[#111111] text-[#111111]',
          message: 'Your access request is waiting for administrator approval.',
        };
    }
  };

  const config = getStatusConfig();
  const submissionDate = request?.createdAt || user?.createdAt;

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
          <ThemeToggle />
          <button
            onClick={logout}
            className={`text-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
              isDark ? 'text-[#94a3b8] hover:text-[#f8fafc]' : 'text-[#777777] hover:text-[#111111]'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Status Container */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-6 my-auto">
        <div
          className={`max-w-md w-full border p-5 sm:p-8 shadow-sm text-center transition-colors duration-150 ${
            isDark
              ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
              : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
          }`}
        >
          {/* Status Icon */}
          <div
            className={`w-14 h-14 border flex items-center justify-center mx-auto mb-4 ${
              isDark ? 'bg-[#0f172a] border-[#334155]' : 'bg-[#fafafa] border-[#e5e5e5]'
            }`}
          >
            {config.icon}
          </div>

          <h1 className="text-xl font-bold tracking-tight mb-2">
            {config.title}
          </h1>

          <p className={`text-xs leading-relaxed mb-6 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
            {config.message}
          </p>

          {/* User & Request Details Box */}
          <div
            className={`border p-4 sm:p-5 text-left text-xs space-y-3 mb-6 ${
              isDark ? 'bg-[#0f172a] border-[#243042]' : 'bg-[#fafafa] border-[#e5e5e5]'
            }`}
          >
            {/* Profile Avatar */}
            <div
              className={`flex items-center space-x-3 pb-3 border-b ${
                isDark ? 'border-[#243042]' : 'border-[#e5e5e5]'
              }`}
            >
              {user?.profileImage ? (
                <img
                  src={user.profileImage}
                  alt={user.name}
                  className={`w-10 h-10 rounded-full border object-cover ${
                    isDark ? 'border-[#334155]' : 'border-[#cccccc]'
                  }`}
                />
              ) : (
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs shrink-0 ${
                    isDark ? 'bg-[#f8fafc] text-[#0b0f17]' : 'bg-[#111111] text-[#ffffff]'
                  }`}
                >
                  {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
              )}
              <div className="overflow-hidden min-w-0">
                <div className="font-semibold truncate">{user?.name || 'Authorized Applicant'}</div>
                <div
                  className={`text-[11px] font-mono truncate ${
                    isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                  }`}
                >
                  {user?.email}
                </div>
              </div>
            </div>

            {/* Current Request Status */}
            <div className="flex justify-between items-center pt-1">
              <span className={isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}>
                Current Status:
              </span>
              <span className={`font-mono font-bold px-2 py-0.5 text-[11px] uppercase ${config.badgeBg}`}>
                {config.badge}
              </span>
            </div>

            {/* Submission Date */}
            <div className="flex justify-between items-center">
              <span className={isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}>
                Submission Date:
              </span>
              <span className="font-mono">
                {submissionDate ? new Date(submissionDate).toLocaleDateString() : 'Just now'}
              </span>
            </div>

            {/* Rejection Reason */}
            {currentStatus === 'REJECTED' && (user?.rejectionReason || request?.rejectionReason) && (
              <div className={`pt-2 border-t ${isDark ? 'border-[#243042]' : 'border-[#e5e5e5]'}`}>
                <span className={`block mb-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                  Reason:
                </span>
                <span
                  className={`italic p-2 border block text-[11px] ${
                    isDark
                      ? 'bg-[#141c2b] border-[#334155] text-[#fca5a5]'
                      : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
                  }`}
                >
                  {user?.rejectionReason || request?.rejectionReason}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={fetchStatus}
              disabled={checking}
              className={`w-full py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer ${
                isDark
                  ? 'bg-[#f8fafc] text-[#0b0f17] hover:bg-[#e2e8f0]'
                  : 'bg-[#111111] text-[#ffffff] hover:bg-[#333333]'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Refreshing Status...' : 'Refresh Status'}</span>
            </button>

            <button
              onClick={logout}
              className={`w-full py-2 border text-xs font-medium transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                isDark
                  ? 'border-[#334155] text-[#f8fafc] hover:bg-[#1e293b]'
                  : 'border-[#e5e5e5] text-[#111111] hover:bg-[#f5f5f5]'
              }`}
            >
              <LogOut className={`w-3.5 h-3.5 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`} />
              <span>Sign Out</span>
            </button>
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
