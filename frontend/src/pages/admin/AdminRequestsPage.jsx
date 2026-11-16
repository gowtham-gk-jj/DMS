import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import api from '../../services/api';

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('PENDING'); // 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState([]);

  // Selected request for approval or rejection modal
  const [activeRequest, setActiveRequest] = useState(null);
  const [modalMode, setModalMode] = useState(null); // 'APPROVE' | 'REJECT'

  // Approval Form State
  const [readPerm, setReadPerm] = useState(true);
  const [uploadPerm, setUploadPerm] = useState(false);
  const [downloadPerm, setDownloadPerm] = useState(false);
  const [managePerm, setManagePerm] = useState(false);
  const [selectedRole, setSelectedRole] = useState('USER');
  const [assignedFolders, setAssignedFolders] = useState([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const [reqRes, folderRes] = await Promise.all([
        api.get(`/admin/requests?status=${statusFilter}&search=${encodeURIComponent(search)}`),
        api.get('/folders?parentId=root'),
      ]);

      if (reqRes.data.success) {
        setRequests(reqRes.data.requests || []);
      }
      if (folderRes.data.success) {
        setFolders(folderRes.data.folders || []);
      }
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, search]);

  const openApproveModal = (req) => {
    setActiveRequest(req);
    setReadPerm(true);
    setUploadPerm(false);
    setDownloadPerm(false);
    setManagePerm(false);
    setSelectedRole('USER');
    setAssignedFolders([]);
    setModalMode('APPROVE');
  };

  const openRejectModal = (req) => {
    setActiveRequest(req);
    setRejectionReason('');
    setModalMode('REJECT');
  };

  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    if (!activeRequest) return;

    try {
      setSubmitting(true);
      const res = await api.post(`/admin/requests/${activeRequest._id}/approve`, {
        permissions: {
          read: readPerm,
          upload: uploadPerm,
          download: downloadPerm,
          manage: managePerm,
        },
        role: selectedRole,
        folderIds: assignedFolders,
      });

      if (res.data.success) {
        setModalMode(null);
        setActiveRequest(null);
        fetchRequests();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!activeRequest) return;

    try {
      setSubmitting(true);
      const res = await api.post(`/admin/requests/${activeRequest._id}/reject`, {
        rejectionReason: rejectionReason.trim(),
      });

      if (res.data.success) {
        setModalMode(null);
        setActiveRequest(null);
        fetchRequests();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFolderSelection = (id) => {
    setAssignedFolders((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-0">
      {/* Header */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
            ACCESS REQUEST AUTHORIZATION QUEUE
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Access Requests
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Evaluate incoming user access submissions, allocate folder privileges, and configure permission levels.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] px-3.5 py-2 font-medium transition-colors cursor-pointer text-center ${
                statusFilter === s
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                  : 'bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--text-secondary)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3.5 sm:top-2.5 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search applicant name, email, organization..."
            className="w-full pl-9 pr-3 py-2 min-h-[44px] sm:min-h-[38px] border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs focus:outline-none focus:border-[var(--text-primary)]"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] transition-colors">
        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[760px]">
            <thead>
              <tr className="bg-[var(--table-header-bg)] text-[var(--table-header-text)] font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-4 border-r border-[var(--border-subtle)]">Applicant</th>
                <th className="py-2.5 px-4 border-r border-[var(--border-subtle)]">Organization / Dept</th>
                <th className="py-2.5 px-4 border-r border-[var(--border-subtle)]">Reason & Purpose</th>
                <th className="py-2.5 px-3 border-r border-[var(--border-subtle)] text-center w-28">Status</th>
                <th className="py-2.5 px-3 border-r border-[var(--border-subtle)] text-center w-28">Date</th>
                <th className="py-2.5 px-4 text-center w-40">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--text-muted)]">
                    Loading access requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--text-muted)]">
                    No access requests found matching &ldquo;{statusFilter}&rdquo;.
                  </td>
                </tr>
              ) : (
                requests.map((req, idx) => (
                  <tr
                    key={req._id}
                    className={`hover:bg-[var(--table-row-hover)] transition-colors ${
                      idx % 2 === 1 ? 'bg-[var(--bg-hover)]' : 'bg-[var(--bg-card)]'
                    }`}
                  >
                    {/* Applicant */}
                    <td className="py-3 px-4 border-r border-[var(--border-subtle)]">
                      <div className="font-semibold text-[var(--text-primary)]">{req.name}</div>
                      <div className="font-mono text-[11px] text-[var(--text-muted)] break-all">{req.email}</div>
                    </td>

                    {/* Organization */}
                    <td className="py-3 px-4 border-r border-[var(--border-subtle)]">
                      <div className="font-medium text-[var(--text-primary)]">{req.organization}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {req.department || 'General'}
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="py-3 px-4 border-r border-[var(--border-subtle)]">
                      <div className="font-medium text-[var(--text-primary)]">{req.reason}</div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        <strong>Purpose:</strong> {req.purpose}
                      </div>
                      {req.rejectionReason && (
                        <div className="text-[11px] text-[var(--text-primary)] bg-[var(--bg-hover)] border border-[var(--border-color)] p-1.5 mt-1">
                          <strong>Admin Feedback:</strong> {req.rejectionReason}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 border-r border-[var(--border-subtle)] text-center">
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 border ${
                          req.status === 'PENDING'
                            ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                            : req.status === 'APPROVED'
                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--text-primary)]'
                            : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-color)]'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-3 border-r border-[var(--border-subtle)] text-center font-mono text-[11px] text-[var(--text-muted)]">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      {req.status === 'PENDING' ? (
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => openApproveModal(req)}
                            className="bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-opacity cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openRejectModal(req)}
                            className="border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[var(--text-muted)] font-mono">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Access Requests Card View (< md) */}
        <div className="block md:hidden divide-y divide-[var(--border-subtle)]">
          {loading ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              Loading access requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              No access requests found matching &ldquo;{statusFilter}&rdquo;.
            </div>
          ) : (
            requests.map((req, idx) => (
              <div
                key={`mob_req_${req._id}`}
                className={`p-4 space-y-3 transition-colors ${
                  idx % 2 === 1 ? 'bg-[var(--bg-hover)]' : 'bg-[var(--bg-card)]'
                }`}
              >
                {/* Applicant & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-[var(--text-primary)] leading-tight">{req.name}</div>
                    <div className="font-mono text-xs text-[var(--text-muted)] break-all mt-0.5">{req.email}</div>
                  </div>
                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 border shrink-0 ${
                      req.status === 'APPROVED'
                        ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--text-primary)]'
                        : req.status === 'REJECTED'
                        ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                        : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-color)]'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>

                {/* Organization & Dept */}
                <div className="text-xs text-[var(--text-primary)]">
                  <span className="font-medium">{req.organization}</span>
                  {req.department && (
                    <span className="text-[var(--text-muted)] text-[11px] ml-1.5">({req.department})</span>
                  )}
                </div>

                {/* Reason & Purpose */}
                <div className="p-2.5 border border-[var(--border-subtle)] bg-[var(--bg-hover)] text-xs text-[var(--text-secondary)] leading-relaxed break-words">
                  {req.reason}
                </div>

                {/* Date */}
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] pt-1">
                  <span>Submitted: {new Date(req.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-[var(--border-subtle)]">
                  {req.status === 'PENDING' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openApproveModal(req)}
                        className="flex-1 min-h-[44px] px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-primary)] font-semibold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center space-x-1"
                      >
                        <Check className="w-4 h-4" />
                        <span>Review & Approve</span>
                      </button>
                      <button
                        onClick={() => openRejectModal(req)}
                        className="min-h-[44px] px-4 py-2 border border-[var(--border-color)] hover:border-red-500 text-red-500 font-semibold text-xs uppercase tracking-wider hover:bg-red-500/10 transition-colors cursor-pointer flex items-center justify-center space-x-1"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-1 text-[11px] text-[var(--text-muted)] font-mono">
                      Request already {req.status?.toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* APPROVAL MODAL WITH FULL PERMISSION CONTROLS */}
      {modalMode === 'APPROVE' && activeRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--modal-bg)] border border-[var(--border-color)] max-w-lg w-full shadow-2xl max-h-[92vh] flex flex-col">
            <div className="bg-[var(--table-header-bg)] text-[var(--table-header-text)] px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-2">
                <h3 className="font-semibold text-sm truncate">Approve Access Request</h3>
                <p className="text-[11px] opacity-75 truncate">
                  Configure repository permissions for <strong>{activeRequest.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setModalMode(null)}
                className="opacity-75 hover:opacity-100 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApproveSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="bg-[var(--bg-hover)] border border-[var(--border-color)] p-3 text-xs space-y-1 text-[var(--text-secondary)]">
                <div>
                  <strong className="text-[var(--text-primary)]">Email:</strong> {activeRequest.email}
                </div>
                <div>
                  <strong className="text-[var(--text-primary)]">Organization:</strong> {activeRequest.organization}
                </div>
                <div>
                  <strong className="text-[var(--text-primary)]">Reason:</strong> {activeRequest.reason}
                </div>
              </div>

              {/* PERMISSION CONTROLS: READ, UPLOAD, DOWNLOAD, MANAGE */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-[11px] text-[var(--text-primary)] mb-2">
                  Granular Permission Controls:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* READ ACCESS */}
                  <label className="flex items-center justify-between border border-[var(--border-color)] p-2.5 bg-[var(--bg-card)] cursor-pointer hover:border-[var(--text-secondary)]">
                    <div>
                      <span className="font-bold text-xs block text-[var(--text-primary)]">READ ACCESS</span>
                      <span className="text-[10px] text-[var(--text-muted)]">Browse & view documents</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={readPerm}
                      onChange={(e) => setReadPerm(e.target.checked)}
                      className="w-4 h-4 accent-[var(--text-primary)] cursor-pointer"
                    />
                  </label>

                  {/* UPLOAD ACCESS */}
                  <label className="flex items-center justify-between border border-[var(--border-color)] p-2.5 bg-[var(--bg-card)] cursor-pointer hover:border-[var(--text-secondary)]">
                    <div>
                      <span className="font-bold text-xs block text-[var(--text-primary)]">UPLOAD ACCESS</span>
                      <span className="text-[10px] text-[var(--text-muted)]">Upload new technical files</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={uploadPerm}
                      onChange={(e) => setUploadPerm(e.target.checked)}
                      className="w-4 h-4 accent-[var(--text-primary)] cursor-pointer"
                    />
                  </label>

                  {/* DOWNLOAD ACCESS */}
                  <label className="flex items-center justify-between border border-[var(--border-color)] p-2.5 bg-[var(--bg-card)] cursor-pointer hover:border-[var(--text-secondary)]">
                    <div>
                      <span className="font-bold text-xs block text-[var(--text-primary)]">DOWNLOAD ACCESS</span>
                      <span className="text-[10px] text-[var(--text-muted)]">Export & save local copies</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={downloadPerm}
                      onChange={(e) => setDownloadPerm(e.target.checked)}
                      className="w-4 h-4 accent-[var(--text-primary)] cursor-pointer"
                    />
                  </label>

                  {/* MANAGE ACCESS */}
                  <label className="flex items-center justify-between border border-[var(--border-color)] p-2.5 bg-[var(--bg-card)] cursor-pointer hover:border-[var(--text-secondary)]">
                    <div>
                      <span className="font-bold text-xs block text-[var(--text-primary)]">MANAGE ACCESS</span>
                      <span className="text-[10px] text-[var(--text-muted)]">Create folders & edit meta</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={managePerm}
                      onChange={(e) => setManagePerm(e.target.checked)}
                      className="w-4 h-4 accent-[var(--text-primary)] cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* ROLE SELECTION */}
              <div>
                <label className="block text-[var(--text-secondary)] mb-1 font-medium">Assign Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] p-2 text-xs focus:outline-none focus:border-[var(--text-primary)]"
                >
                  <option value="USER">User (Standard Document Consumer)</option>
                  <option value="MANAGER">Manager (Document Contributor & Editor)</option>
                  <option value="ADMIN">Admin (Full System Administrator)</option>
                </select>
              </div>

              {/* FOLDER ASSIGNMENT */}
              {folders.length > 0 && (
                <div>
                  <label className="block text-[var(--text-secondary)] mb-1 font-medium">
                    Assign Specific Folder Access (Leave empty for all standard repositories)
                  </label>
                  <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-2 max-h-32 overflow-y-auto space-y-1">
                    {folders.map((f) => (
                      <label key={f._id} className="flex items-center space-x-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assignedFolders.includes(f._id)}
                          onChange={() => toggleFolderSelection(f._id)}
                          className="accent-[var(--text-primary)] cursor-pointer"
                        />
                        <span className="font-medium text-[var(--text-primary)]">{f.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-[var(--border-subtle)] pt-3 flex items-center justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  disabled={submitting}
                  className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[var(--text-primary)] text-[var(--bg-primary)] font-semibold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Approving...' : 'Confirm Approval & Send Notification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {modalMode === 'REJECT' && activeRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--modal-bg)] border border-[var(--border-color)] max-w-md w-full shadow-2xl">
            <div className="bg-[var(--table-header-bg)] text-[var(--table-header-text)] px-5 py-3.5 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <h3 className="font-semibold text-sm truncate">Reject Access Request</h3>
                <p className="text-[11px] opacity-75 truncate">
                  Decline request for <strong>{activeRequest.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setModalMode(null)}
                className="opacity-75 hover:opacity-100 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[var(--text-secondary)] mb-1 font-medium">
                  Rejection Reason / Administrator Feedback
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Incomplete organization verification, corporate email required, unauthorized division..."
                  required
                  className="w-full border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] p-2 text-xs focus:outline-none focus:border-[var(--text-primary)]"
                />
              </div>

              <div className="border-t border-[var(--border-subtle)] pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  disabled={submitting}
                  className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-primary)] font-semibold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Rejecting...' : 'Reject Request & Send Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
