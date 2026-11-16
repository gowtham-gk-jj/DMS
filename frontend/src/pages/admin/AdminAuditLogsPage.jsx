import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../services/api';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get(
        `/audit?action=${selectedAction}&search=${encodeURIComponent(search)}&page=${page}&limit=25`
      );
      if (res.data.success) {
        setLogs(res.data.logs || []);
        setActions(res.data.actions || []);
        setTotalPages(res.data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedAction, search, page]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="dms-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
            IMMUTABLE SECURITY AUDIT TRAIL
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Security Audit Logs
          </h1>
          <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] mt-1">
            Track user logins, access requests, admin approvals, document previews, uploads, and downloads.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setPage(1);
            }}
            className="dms-input min-h-[38px] w-auto text-xs"
          >
            <option value="ALL">All Actions ({actions.length})</option>
            {actions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search Input */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search email, username, target document or folder..."
            className="dms-input pl-9"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="dms-card overflow-hidden">
        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[760px]">
            <thead>
              <tr className="bg-[var(--table-header-bg)] text-[var(--table-header-text)] font-semibold text-[11px] uppercase tracking-wider border-b border-[var(--border-color)]">
                <th className="py-2.5 px-4 border-r border-[var(--border-subtle)] w-40 font-mono">Timestamp</th>
                <th className="py-2.5 px-4 border-r border-[var(--border-subtle)] w-48">Actor (User)</th>
                <th className="py-2.5 px-3 border-r border-[var(--border-subtle)] text-center w-48 font-mono">Action</th>
                <th className="py-2.5 px-4 border-r border-[var(--border-subtle)]">Target Subject</th>
                <th className="py-2.5 px-4">Event Details</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--text-muted)] font-mono">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--text-secondary)]">
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr
                    key={log._id}
                    className={`hover:bg-[var(--bg-hover)] transition-colors ${
                      idx % 2 === 1 ? 'bg-[var(--bg-card)]' : 'bg-[var(--bg-elevated)]'
                    }`}
                  >
                    {/* Timestamp */}
                    <td className="py-2.5 px-4 border-r border-[var(--border-subtle)] font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>

                    {/* Actor */}
                    <td className="py-2.5 px-4 border-r border-[var(--border-subtle)]">
                      <div className="font-semibold text-[var(--text-primary)]">{log.userName || 'System'}</div>
                      <div className="font-mono text-[11px] text-[var(--text-muted)] break-all mt-0.5">{log.userEmail}</div>
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 border-r border-[var(--border-subtle)] text-center font-mono">
                      <span className="dms-badge dms-badge-neutral text-[10px]">
                        {log.action}
                      </span>
                    </td>

                    {/* Target */}
                    <td className="py-2.5 px-4 border-r border-[var(--border-subtle)]">
                      <div className="font-medium text-[var(--text-primary)]">{log.targetName || '—'}</div>
                      <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                        {log.targetType} {log.targetId ? `(${log.targetId.slice(-6)})` : ''}
                      </div>
                    </td>

                    {/* Details */}
                    <td className="py-2.5 px-4 text-[11px] font-mono text-[var(--text-secondary)]">
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <div className="max-w-md truncate break-all">
                          {JSON.stringify(log.details)}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Audit Logs Card View (< md) */}
        <div className="block md:hidden divide-y divide-[var(--border-subtle)]">
          {loading ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)] font-mono">
              Loading audit trail...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-secondary)]">
              No audit records match the current filter.
            </div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={`mob_log_${log._id}`}
                className={`p-4 space-y-2.5 transition-colors ${
                  idx % 2 === 1 ? 'bg-[var(--bg-card)]' : 'bg-[var(--bg-elevated)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="dms-badge dms-badge-neutral text-[10px]">
                    {log.action}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="text-xs">
                  <div className="font-semibold text-[var(--text-primary)]">{log.userName || 'System'}</div>
                  <div className="font-mono text-[11px] text-[var(--text-muted)] break-all mt-0.5">{log.userEmail}</div>
                </div>

                {(log.targetName || log.targetType) && (
                  <div className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-elevated)] p-2.5 rounded-md border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)]">Target:</span>{' '}
                    <strong className="text-[var(--text-primary)]">{log.targetName || '—'}</strong>
                    {log.targetType && (
                      <span className="text-[10px] text-[var(--text-muted)] ml-1">({log.targetType})</span>
                    )}
                  </div>
                )}

                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="text-[10px] font-mono text-[var(--text-muted)] break-all bg-[var(--bg-main)] p-2 rounded border border-[var(--border-subtle)]">
                    {JSON.stringify(log.details)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-[var(--border-subtle)] p-3 px-4 bg-[var(--bg-elevated)] flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)] font-mono text-[11px]">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="dms-btn-secondary px-3 py-1.5 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="dms-btn-secondary px-3 py-1.5 text-xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
