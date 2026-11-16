import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck2, Users, FolderTree, FileText, HardDrive, ShieldCheck, ArrowRight, Clock, AlertTriangle } from 'lucide-react';
import api from '../../services/api';

export default function AdminOverviewPage() {
  const [stats, setStats] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        setLoading(true);
        const res = await api.get('/admin/stats');
        if (res.data.success) {
          setStats(res.data.stats);
          setRecentRequests(res.data.recentRequests || []);
          setRecentUsers(res.data.recentUsers || []);
        }
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="p-12 text-center text-xs font-mono text-[var(--text-muted)] dms-card">
        Loading administrative telemetry and access queues...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="dms-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
            SYSTEM ADMINISTRATION & SECURITY CONSOLE
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Administrator Dashboard
          </h1>
          <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] mt-1">
            Manage user authorization, access requests, folder permissions, and catalogue security.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => navigate('/admin/requests')}
            className="dms-btn-primary w-full sm:w-auto px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Review Access Requests ({stats?.pendingRequests || 0})</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="dms-card p-3.5 transition-all">
          <div className="text-[11px] text-[var(--text-muted)] font-mono uppercase tracking-wider truncate">
            Total Users
          </div>
          <div className="text-xl font-bold font-mono text-[var(--text-primary)] mt-1">
            {stats?.totalUsers || 0}
          </div>
        </div>

        <div className="dms-card p-3.5 border-[var(--primary-blue)] transition-all bg-[var(--primary-subtle)]">
          <div className="text-[11px] text-[var(--primary-blue)] font-mono font-bold uppercase tracking-wider flex items-center justify-between">
            <span className="truncate">Pending</span>
            <span className="w-2 h-2 rounded-full bg-[var(--primary-blue)] animate-pulse shrink-0" />
          </div>
          <div className="text-xl font-bold font-mono text-[var(--primary-blue)] mt-1">
            {stats?.pendingRequests || 0}
          </div>
        </div>

        <div className="dms-card p-3.5 transition-all">
          <div className="text-[11px] text-[var(--text-muted)] font-mono uppercase tracking-wider truncate">
            Approved
          </div>
          <div className="text-xl font-bold font-mono text-[var(--text-primary)] mt-1">
            {stats?.approvedUsers || 0}
          </div>
        </div>

        <div className="dms-card p-3.5 transition-all">
          <div className="text-[11px] text-[var(--text-muted)] font-mono uppercase tracking-wider truncate">
            Suspended
          </div>
          <div className="text-xl font-bold font-mono text-[var(--text-primary)] mt-1">
            {stats?.suspendedUsers || 0}
          </div>
        </div>

        <div className="dms-card p-3.5 transition-all">
          <div className="text-[11px] text-[var(--text-muted)] font-mono uppercase tracking-wider truncate">
            Folders
          </div>
          <div className="text-xl font-bold font-mono text-[var(--text-primary)] mt-1">
            {stats?.totalFolders || 0}
          </div>
        </div>

        <div className="dms-card p-3.5 transition-all">
          <div className="text-[11px] text-[var(--text-muted)] font-mono uppercase tracking-wider truncate">
            Documents
          </div>
          <div className="text-xl font-bold font-mono text-[var(--text-primary)] mt-1">
            {stats?.totalDocuments || 0}
          </div>
        </div>

        <div className="dms-card p-3.5 transition-all col-span-2 sm:col-span-1">
          <div className="text-[11px] text-[var(--text-muted)] font-mono uppercase tracking-wider truncate">
            Storage
          </div>
          <div className="text-xl font-bold font-mono text-[var(--text-primary)] mt-1 truncate">
            {stats?.storageFormatted || '0 MB'}
          </div>
        </div>
      </div>

      {/* Grid: Pending Requests & Recent Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pending Requests Column */}
        <div className="dms-card overflow-hidden">
          <div className="border-b border-[var(--border-color)] px-4 py-3 bg-[var(--bg-elevated)] flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-[var(--text-primary)] font-mono">
              Recent Access Requests
            </span>
            <button
              onClick={() => navigate('/admin/requests')}
              className="text-[var(--primary-blue)] hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
            >
              <span>View All Requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {recentRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                No access requests awaiting review.
              </div>
            ) : (
              recentRequests.map((req) => (
                <div key={req._id} className="p-4 hover:bg-[var(--bg-hover)] text-xs transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--text-primary)] truncate">{req.name}</div>
                      <div className="text-[11px] font-mono text-[var(--text-muted)] break-all mt-0.5">{req.email}</div>
                    </div>
                    <span
                      className={`dms-badge shrink-0 ${
                        req.status === 'PENDING'
                          ? 'dms-badge-warning'
                          : req.status === 'APPROVED'
                          ? 'dms-badge-success'
                          : 'dms-badge-error'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <div className="mt-2.5 text-[11px] text-[var(--text-secondary)] bg-[var(--bg-elevated)] border border-[var(--border-color)] p-2.5 rounded-md space-y-0.5">
                    <div>
                      <strong className="text-[var(--text-primary)]">Organization:</strong> {req.organization}
                    </div>
                    <div>
                      <strong className="text-[var(--text-primary)]">Reason:</strong> {req.reason}
                    </div>
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => navigate('/admin/requests')}
                        className="dms-btn-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
                      >
                        <span>Review & Set Permissions</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Registered Users Column */}
        <div className="dms-card overflow-hidden">
          <div className="border-b border-[var(--border-color)] px-4 py-3 bg-[var(--bg-elevated)] flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-[var(--text-primary)] font-mono">
              Recent Users
            </span>
            <button
              onClick={() => navigate('/admin/users')}
              className="text-[var(--primary-blue)] hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
            >
              <span>Manage Users</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {recentUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                No users found.
              </div>
            ) : (
              recentUsers.map((u) => (
                <div key={u._id} className="p-4 hover:bg-[var(--bg-hover)] text-xs flex items-center justify-between gap-2 transition-colors">
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--text-primary)] truncate">{u.name}</div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)] break-all mt-0.5">{u.email}</div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-[10px] font-mono border border-[var(--border-color)] px-1.5 py-0.5 rounded-xs bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                      {u.role}
                    </span>
                    <span
                      className={`dms-badge ${
                        u.status === 'APPROVED'
                          ? 'dms-badge-success'
                          : u.status === 'PENDING'
                          ? 'dms-badge-warning'
                          : 'dms-badge-error'
                      }`}
                    >
                      {u.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
