import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck2 } from 'lucide-react';
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
      <div className="p-12 text-center text-xs font-mono text-[var(--text-muted)] border border-[var(--border-color)] bg-[var(--bg-card)]">
        Loading administrative telemetry and access queues...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-0">
      {/* Top Banner */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
            SYSTEM ADMINISTRATION & SECURITY CONSOLE
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Administrator Dashboard
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Manage user authorization, access requests, folder permissions, and catalogue security.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => navigate('/admin/requests')}
            className="w-full sm:w-auto px-4 py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Review Access Requests ({stats?.pendingRequests || 0})</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
        <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:p-3.5 transition-colors">
          <div className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider truncate">
            Total Users
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[var(--text-primary)] mt-1">
            {stats?.totalUsers || 0}
          </div>
        </div>

        <div className="border border-[var(--text-primary)] bg-[var(--bg-hover)] p-3 sm:p-3.5 transition-colors">
          <div className="text-[10px] text-[var(--text-primary)] font-bold uppercase tracking-wider flex items-center justify-between">
            <span className="truncate">Pending</span>
            <span className="w-2 h-2 rounded-full bg-[var(--text-primary)] shrink-0"></span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[var(--text-primary)] mt-1">
            {stats?.pendingRequests || 0}
          </div>
        </div>

        <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:p-3.5 transition-colors">
          <div className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider truncate">
            Approved
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[var(--text-primary)] mt-1">
            {stats?.approvedUsers || 0}
          </div>
        </div>

        <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:p-3.5 transition-colors">
          <div className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider truncate">
            Suspended
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[var(--text-primary)] mt-1">
            {stats?.suspendedUsers || 0}
          </div>
        </div>

        <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:p-3.5 transition-colors">
          <div className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider truncate">
            Folders
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[var(--text-primary)] mt-1">
            {stats?.totalFolders || 0}
          </div>
        </div>

        <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:p-3.5 transition-colors">
          <div className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider truncate">
            Documents
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[var(--text-primary)] mt-1">
            {stats?.totalDocuments || 0}
          </div>
        </div>

        <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:p-3.5 transition-colors col-span-2 sm:col-span-1">
          <div className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider truncate">
            Cloud Storage
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[var(--text-primary)] mt-1">
            {stats?.storageFormatted || '0 MB'}
          </div>
        </div>
      </div>

      {/* Grid: Pending Requests & Recent Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Requests Column */}
        <div className="border border-[var(--border-color)] bg-[var(--bg-card)] transition-colors">
          <div className="border-b border-[var(--border-color)] px-4 py-3 bg-[var(--bg-hover)] flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Recent Access Requests
            </span>
            <button
              onClick={() => navigate('/admin/requests')}
              className="text-[var(--text-primary)] hover:underline font-medium cursor-pointer"
            >
              View All Requests →
            </button>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {recentRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                No access requests awaiting review.
              </div>
            ) : (
              recentRequests.map((req) => (
                <div key={req._id} className="p-3.5 hover:bg-[var(--bg-hover)] text-xs transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--text-primary)] truncate">{req.name}</div>
                      <div className="text-[11px] font-mono text-[var(--text-muted)] break-all">{req.email}</div>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border shrink-0 ${
                        req.status === 'PENDING'
                          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                          : req.status === 'APPROVED'
                          ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--text-primary)]'
                          : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-color)]'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <div className="mt-2 text-[11px] text-[var(--text-secondary)] bg-[var(--bg-hover)] border border-[var(--border-color)] p-2">
                    <div>
                      <strong>Organization:</strong> {req.organization}
                    </div>
                    <div>
                      <strong>Reason:</strong> {req.reason}
                    </div>
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="mt-2.5 flex justify-end">
                      <button
                        onClick={() => navigate('/admin/requests')}
                        className="w-full sm:w-auto px-3 py-1 bg-[var(--text-primary)] text-[var(--bg-primary)] text-[11px] font-medium hover:opacity-90 transition-opacity cursor-pointer text-center"
                      >
                        Review & Set Permissions →
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Registered Users Column */}
        <div className="border border-[var(--border-color)] bg-[var(--bg-card)] transition-colors">
          <div className="border-b border-[var(--border-color)] px-4 py-3 bg-[var(--bg-hover)] flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Recent Users
            </span>
            <button
              onClick={() => navigate('/admin/users')}
              className="text-[var(--text-primary)] hover:underline font-medium cursor-pointer"
            >
              Manage Users →
            </button>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {recentUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                No users found.
              </div>
            ) : (
              recentUsers.map((u) => (
                <div key={u._id} className="p-3.5 hover:bg-[var(--bg-hover)] text-xs flex items-center justify-between gap-2 transition-colors">
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--text-primary)] truncate">{u.name}</div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)] break-all">{u.email}</div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-[10px] font-mono border border-[var(--border-color)] px-1.5 py-0.5 text-[var(--text-secondary)]">
                      {u.role}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border ${
                        u.status === 'APPROVED'
                          ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--text-primary)]'
                          : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-color)]'
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
