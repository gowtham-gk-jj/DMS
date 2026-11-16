import React, { useState, useEffect } from 'react';
import { RefreshCw, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../services/api';

export default function AdminEmailLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/email-logs?page=${page}&limit=20`);
      if (res.data.success) {
        setLogs(res.data.logs || []);
        setTotalPages(res.data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to load email logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="dms-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
            NOTIFICATION DISPATCH & EMAIL LOGS
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Email Notification Logs
          </h1>
          <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] mt-1">
            Audited history of access request alerts, approval confirmations, rejection notices, and permission updates.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="dms-btn-secondary w-full sm:w-auto px-3.5 py-2 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[var(--primary-blue)]' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Logs Table */}
      <div className="dms-card overflow-hidden">
        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[700px]">
            <thead>
              <tr className="bg-[var(--table-header-bg)] text-[var(--table-header-text)] font-semibold text-[11px] uppercase tracking-wider border-b border-[var(--border-color)]">
                <th className="py-2.5 px-4 border-r border-[var(--border-subtle)] w-44 font-mono">Dispatched At</th>
                <th className="py-2.5 px-4 border-r border-[var(--border-subtle)] w-56 font-mono">Recipient Email</th>
                <th className="py-2.5 px-4 border-r border-[var(--border-subtle)]">Subject</th>
                <th className="py-2.5 px-3 border-r border-[var(--border-subtle)] text-center w-36 font-mono">Template</th>
                <th className="py-2.5 px-3 text-center w-28 font-mono">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--text-muted)] font-mono">
                    Loading email dispatch logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--text-secondary)]">
                    No email notification logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr
                    key={log._id}
                    className={`hover:bg-[var(--table-row-hover)] transition-colors ${
                      idx % 2 === 1 ? 'bg-[var(--bg-card)]' : 'bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <td className="py-2.5 px-4 border-r border-[var(--border-subtle)] font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 border-r border-[var(--border-subtle)] font-mono text-[var(--text-primary)] break-all">
                      {log.recipient}
                    </td>
                    <td className="py-2.5 px-4 border-r border-[var(--border-subtle)] font-medium text-[var(--text-primary)]">
                      {log.subject}
                    </td>
                    <td className="py-2.5 px-3 border-r border-[var(--border-subtle)] text-center font-mono text-[10px] text-[var(--text-muted)]">
                      {log.template}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`dms-badge ${
                          log.status === 'SENT'
                            ? 'dms-badge-success'
                            : log.status === 'SIMULATED'
                            ? 'dms-badge-info'
                            : 'dms-badge-warning'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Email Logs Card View (< md) */}
        <div className="block md:hidden divide-y divide-[var(--border-subtle)]">
          {loading ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)] font-mono">
              Loading email dispatch logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-secondary)]">
              No email notification logs found.
            </div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={`mob_email_${log._id}`}
                className={`p-4 space-y-2.5 transition-colors ${
                  idx % 2 === 1 ? 'bg-[var(--bg-card)]' : 'bg-[var(--bg-elevated)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`dms-badge ${
                      log.status === 'SENT'
                        ? 'dms-badge-success'
                        : log.status === 'SIMULATED'
                        ? 'dms-badge-info'
                        : 'dms-badge-warning'
                    }`}
                  >
                    {log.status}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="text-xs font-semibold text-[var(--text-primary)]">
                  {log.subject}
                </div>

                <div className="text-[11px] font-mono text-[var(--text-muted)] break-all">
                  To: {log.recipient}
                </div>

                <div className="text-[10px] font-mono text-[var(--text-secondary)]">
                  Template: {log.template}
                </div>
              </div>
            ))
          )}
        </div>

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
