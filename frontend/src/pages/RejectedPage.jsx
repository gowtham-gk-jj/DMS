import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldX, LogOut, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function RejectedPage() {
  const { user, logout, isSuspended } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col justify-between text-[var(--text-primary)] transition-colors">
      <header className="border-b border-[var(--border-color)] px-4 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between bg-[var(--bg-card)]">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center font-bold text-xs font-mono">
            D
          </div>
          <span className="font-bold text-xs sm:text-sm tracking-tight uppercase">
            ENTERPRISE DMS
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <button
            onClick={logout}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center space-x-1 p-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full border border-[var(--border-color)] p-6 sm:p-8 bg-[var(--bg-card)] shadow-lg text-center transition-colors">
          <div className="w-12 h-12 bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-center mx-auto mb-4">
            <ShieldX className="w-6 h-6 text-[var(--text-primary)]" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] mb-2">
            {isSuspended ? 'Account Suspended' : 'Access Request Not Approved'}
          </h1>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-6">
            {isSuspended
              ? 'Your account has been temporarily suspended by an administrator. You currently do not have access to the document library.'
              : 'Thank you for your request. The system administrator was unable to approve document library access at this time.'}
          </p>

          {user?.rejectionReason && (
            <div className="bg-[var(--bg-hover)] border border-[var(--border-color)] p-4 text-left text-xs mb-6">
              <span className="font-semibold text-[var(--text-primary)] block mb-1">
                Administrator Feedback:
              </span>
              <p className="text-[var(--text-secondary)] leading-relaxed">{user.rejectionReason}</p>
            </div>
          )}

          <div className="text-left bg-[var(--bg-hover)] border border-[var(--border-color)] p-3 text-xs mb-6 space-y-1">
            <div className="text-[var(--text-muted)]">
              User: <span className="font-semibold text-[var(--text-primary)]">{user?.name}</span>
            </div>
            <div className="text-[var(--text-muted)]">
              Email: <span className="font-mono text-[var(--text-primary)] break-all">{user?.email}</span>
            </div>
          </div>

          <div className="space-y-2">
            {!isSuspended && (
              <button
                onClick={() => navigate('/request-access')}
                className="w-full py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center justify-center space-x-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Submit New Request</span>
              </button>
            )}

            <button
              onClick={logout}
              className="w-full py-2 border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-medium hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <footer className="border-t border-[var(--border-color)] px-4 sm:px-8 py-3.5 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-card)]">
        For questions regarding access policies, please contact your organization administrator.
      </footer>
    </div>
  );
}
