import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
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
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-0">
      {/* Header */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
            IMMUTABLE SECURITY AUDIT TRAIL
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Security Audit Logs
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
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
            className="border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] p-2 text-xs focus:outline-none focus:border-[var(--text-primary)]"
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
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search email, username, target document or folder..."
            className="w-full pl-9 pr-3 py-2 border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs focus:outline-none focus:border-[var(--text-primary)]"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[760px]">
            <thead>
              <tr className="bg-[var(--table-header-bg)] text-[var(--table-header-text)] font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-4 border-r border-[var(--border-subtle)] w-40">Timestamp</th>
                <th className="py-2.5 px-4 border-r border-[var(--border-subtle)] w-48">Actor (User)</th>
                <th className="py-2.5 px-3 border-r border-[var(--border-subtle)] text-center w-48">Action</th>
                <th className="py-2.5 px-4 border-r border-[var(--border-subtle)]">Target Subject</th>
                <th className="py-2.5 px-4">Event Details</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--text-muted)]">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--text-muted)]">
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr
                    key={log._id}
                    className={`hover:bg-[var(--table-row-hover)] transition-colors ${
                      idx % 2 === 1 ? 'bg-[var(--bg-hover)]' : 'bg-[var(--bg-card)]'
                    }`}
                  >
                    {/* Timestamp */}
                    <td className="py-2.5 px-4 border-r border-[var(--border-subtle)] font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>

                    {/* Actor */}
                    <td className="py-2.5 px-4 border-r border-[var(--border-subtle)]">
                      <div className="font-semibold text-[var(--text-primary)]">{log.userName || 'System'}</div>
                      <div className="font-mono text-[11px] text-[var(--text-muted)] break-all">{log.userEmail}</div>
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 border-r border-[var(--border-subtle)] text-center font-mono">
                      <span className="bg-[var(--badge-bg)] border border-[var(--border-color)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-primary)] whitespace-nowrap inline-block">
                        {log.action}
                      </span>
                    </td>

                    {/* Target */}
                    <td className="py-2.5 px-4 border-r border-[var(--border-subtle)]">
                      <div className="font-medium text-[var(--text-primary)]">{log.targetName || '—'}</div>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-[var(--border-subtle)] p-3 bg-[var(--bg-hover)] flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">
              Page {page} of {totalPages}
            </span>
            <div className="space-x-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
