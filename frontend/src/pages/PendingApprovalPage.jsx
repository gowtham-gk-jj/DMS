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
          icon: <CheckCircle2 className="w-8 h-8 text-[var(--color-success)]" />,
          title: 'Access Approved',
          badge: 'APPROVED',
          badgeClass: 'dms-badge-success',
          message: 'Your access has been approved. You can now access your authorized technical document library.',
        };
      case 'REJECTED':
        return {
          icon: <XCircle className="w-8 h-8 text-[var(--color-error)]" />,
          title: 'Access Request Rejected',
          badge: 'REJECTED',
          badgeClass: 'dms-badge-error',
          message: 'Your access request was rejected. Contact an administrator for assistance or permission upgrades.',
        };
      case 'SUSPENDED':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-[var(--color-warning)]" />,
          title: 'Account Suspended',
          badge: 'SUSPENDED',
          badgeClass: 'dms-badge-warning',
          message: 'Your account is currently suspended by an administrator.',
        };
      case 'PENDING':
      default:
        return {
          icon: <Clock className="w-8 h-8 text-[var(--primary-blue)]" />,
          title: 'Access Request Pending',
          badge: 'PENDING',
          badgeClass: 'dms-badge-warning',
          message: 'Your access request is currently queued for administrator approval.',
        };
    }
  };

  const config = getStatusConfig();
  const submissionDate = request?.createdAt || user?.createdAt;

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
          <ThemeToggle />
          <button
            onClick={logout}
            className="text-xs flex items-center space-x-1.5 transition-colors cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Status Container */}
      <div className="flex-1 flex items-center justify-center p-3.5 sm:p-6 my-auto page-enter">
        <div className="max-w-md w-full dms-card p-6 sm:p-8 text-center">
          {/* Status Icon */}
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-[var(--bg-elevated)] border border-[var(--border-color)]">
            {config.icon}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-2">
            {config.title}
          </h1>

          <p className="text-xs sm:text-[13px] leading-relaxed text-[var(--text-secondary)] mb-6">
            {config.message}
          </p>

          {/* User & Request Details Box */}
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] p-4 sm:p-5 text-left text-xs space-y-3 mb-6">
            {/* Profile Avatar */}
            <div className="flex items-center space-x-3 pb-3 border-b border-[var(--border-color)]">
              {user?.profileImage ? (
                <img
                  src={user.profileImage}
                  alt={user.name}
                  className="w-10 h-10 rounded-full border border-[var(--border-color)] object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs shrink-0 bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]">
                  {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
              )}
              <div className="overflow-hidden min-w-0">
                <div className="font-semibold truncate text-[var(--text-primary)]">{user?.name || 'Authorized Applicant'}</div>
                <div className="text-[11px] font-mono truncate text-[var(--text-secondary)]">
                  {user?.email}
                </div>
              </div>
            </div>

            {/* Current Request Status */}
            <div className="flex justify-between items-center pt-1">
              <span className="text-[var(--text-secondary)]">Current Status:</span>
              <span className={`dms-badge ${config.badgeClass}`}>
                {config.badge}
              </span>
            </div>

            {/* Submission Date */}
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-secondary)]">Submission Date:</span>
              <span className="font-mono text-[var(--text-primary)]">
                {submissionDate ? new Date(submissionDate).toLocaleDateString() : 'Just now'}
              </span>
            </div>

            {/* Rejection Reason */}
            {currentStatus === 'REJECTED' && (user?.rejectionReason || request?.rejectionReason) && (
              <div className="pt-2 border-t border-[var(--border-color)]">
                <span className="block mb-1 text-[var(--text-secondary)]">Reason:</span>
                <span className="italic p-2.5 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)] block text-[11px]">
                  {user?.rejectionReason || request?.rejectionReason}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            <button
              onClick={fetchStatus}
              disabled={checking}
              className="dms-btn-primary w-full py-2.5 text-xs font-semibold uppercase tracking-wider"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Refreshing Status...' : 'Refresh Status'}</span>
            </button>

            <button
              onClick={logout}
              className="dms-btn-secondary w-full py-2.5 text-xs font-medium"
            >
              <LogOut className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Sign Out</span>
            </button>
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
