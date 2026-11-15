import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, AlertCircle, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';

export default function AccessRequestPage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [organization, setOrganization] = useState('');
  const [department, setDepartment] = useState('');
  const [reason, setReason] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!organization.trim() || !reason.trim() || !purpose.trim()) {
      setError('Please provide organization, reason, and requested access purpose.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await api.post('/requests', {
        organization: organization.trim(),
        department: department.trim(),
        reason: reason.trim(),
        purpose: purpose.trim(),
      });

      if (res.data.success) {
        await refreshUser();
        navigate('/pending-approval');
      }
    } catch (err) {
      console.error('Submit request error:', err);
      setError(err.response?.data?.message || 'Failed to submit access request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col justify-between text-[var(--text-primary)] transition-colors">
      {/* Header */}
      <header className="border-b border-[var(--border-color)] px-4 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between bg-[var(--bg-card)]">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center font-bold text-xs font-mono">
            D
          </div>
          <span className="font-bold text-xs sm:text-sm tracking-tight uppercase">
            DOCUMENT ACCESS REQUEST
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

      {/* Main Request Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-lg w-full border border-[var(--border-color)] p-5 sm:p-8 bg-[var(--bg-card)] shadow-lg transition-colors">
          <div className="mb-6">
            <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider block mb-1">
              STEP 2 OF 2: VERIFICATION & ACCESS SCOPE
            </span>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Request Document Library Access
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Your Google identity is verified. Please complete this access request for administrator review and folder permission allocation.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-xs flex items-center space-x-2 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Readonly Google Account Info */}
            <div className="bg-[var(--bg-hover)] border border-[var(--border-color)] p-3 space-y-2">
              <div>
                <span className="text-[var(--text-muted)] block text-[11px]">Full Name (from Google):</span>
                <span className="font-semibold text-xs text-[var(--text-primary)]">{user?.name}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[11px]">Email Address (from Google):</span>
                <span className="font-mono text-xs text-[var(--text-primary)] break-all">{user?.email}</span>
              </div>
            </div>

            {/* User Input Fields */}
            <div>
              <label className="block text-[var(--text-secondary)] mb-1 font-medium">
                Organization / Company Name *
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. Acme Industrial Automation / Siemens Partner"
                required
                className="w-full border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] p-2 text-xs focus:outline-none focus:border-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-[var(--text-secondary)] mb-1 font-medium">
                Department / Team (Optional)
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. CNC Commissioning / Field Engineering / Electrical Design"
                className="w-full border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] p-2 text-xs focus:outline-none focus:border-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-[var(--text-secondary)] mb-1 font-medium">
                Reason for Requesting Access *
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe your technical need to access the SINUMERIK / SINAMICS document library..."
                required
                className="w-full border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] p-2 text-xs focus:outline-none focus:border-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-[var(--text-secondary)] mb-1 font-medium">
                Requested Access Purpose *
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Machine retrofitting, 840D sl programming, service diagnosis"
                required
                className="w-full border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] p-2 text-xs focus:outline-none focus:border-[var(--text-primary)]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Submitting Request...' : 'Submit Access Request'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color)] px-4 sm:px-8 py-3.5 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-card)]">
        Requests are routed to the system administrator and evaluated within one business day.
      </footer>
    </div>
  );
}
