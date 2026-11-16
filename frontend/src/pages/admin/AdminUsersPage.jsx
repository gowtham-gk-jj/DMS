import React, { useState, useEffect } from 'react';
import { Search, UserX, UserCheck, Edit, X } from 'lucide-react';
import api from '../../services/api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Edit User Permissions Modal
  const [editingUser, setEditingUser] = useState(null);
  const [editRole, setEditRole] = useState('USER');
  const [editStatus, setEditStatus] = useState('APPROVED');
  const [editPerms, setEditPerms] = useState({
    read: true,
    upload: false,
    download: false,
    manage: false,
  });
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get(
        `/admin/users?status=${statusFilter}&role=${roleFilter}&search=${encodeURIComponent(search)}`
      );
      if (res.data.success) {
        setUsers(res.data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [statusFilter, roleFilter, search]);

  const openEditModal = (u) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditStatus(u.status);
    setEditPerms({
      read: Boolean(u.permissions?.read),
      upload: Boolean(u.permissions?.upload),
      download: Boolean(u.permissions?.download),
      manage: Boolean(u.permissions?.manage),
    });
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setSaving(true);
      const res = await api.put(`/admin/users/${editingUser._id}`, {
        role: editRole,
        status: editStatus,
        permissions: editPerms,
      });

      if (res.data.success) {
        setEditingUser(null);
        fetchUsers();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSuspend = async (u) => {
    const newStatus = u.status === 'SUSPENDED' ? 'APPROVED' : 'SUSPENDED';
    const confirmMsg =
      newStatus === 'SUSPENDED'
        ? `Are you sure you want to suspend ${u.email}? They will immediately lose document library access.`
        : `Re-activate ${u.email}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.put(`/admin/users/${u._id}`, {
        status: newStatus,
      });
      if (res.data.success) {
        fetchUsers();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to change status');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-0">
      {/* Header */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
            USER ROSTER & SECURITY POLICY MANAGEMENT
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            User Management & Permissions
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Modify roles, toggle READ/UPLOAD/DOWNLOAD/MANAGE permissions, or suspend user access in real time.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-initial min-h-[44px] sm:min-h-[38px] border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] p-2 text-xs focus:outline-none focus:border-[var(--text-primary)]"
          >
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending Request</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="flex-1 sm:flex-initial min-h-[44px] sm:min-h-[38px] border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] p-2 text-xs focus:outline-none focus:border-[var(--text-primary)]"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">User</option>
            <option value="MANAGER">Manager</option>
          </select>
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
            placeholder="Search users by name, email, department..."
            className="w-full pl-9 pr-3 py-2 min-h-[44px] sm:min-h-[38px] border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs focus:outline-none focus:border-[var(--text-primary)]"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] transition-colors">
        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[700px]">
            <thead>
              <tr className="bg-[var(--table-header-bg)] text-[var(--table-header-text)] font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-4 border-r border-[var(--border-subtle)]">User Name & Email</th>
                <th className="py-2.5 px-3 border-r border-[var(--border-subtle)] text-center w-24">Role</th>
                <th className="py-2.5 px-3 border-r border-[var(--border-subtle)] text-center w-28">Status</th>
                <th className="py-2.5 px-4 border-r border-[var(--border-subtle)]">Active Permissions</th>
                <th className="py-2.5 px-3 border-r border-[var(--border-subtle)] text-center w-28">Last Login</th>
                <th className="py-2.5 px-4 text-center w-36">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--text-muted)]">
                    Loading user records...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--text-muted)]">
                    No users found matching current filters.
                  </td>
                </tr>
              ) : (
                users.map((u, idx) => (
                  <tr
                    key={u._id}
                    className={`hover:bg-[var(--table-row-hover)] transition-colors ${
                      idx % 2 === 1 ? 'bg-[var(--bg-hover)]' : 'bg-[var(--bg-card)]'
                    }`}
                  >
                    {/* Name & Email */}
                    <td className="py-3 px-4 border-r border-[var(--border-subtle)]">
                      <div className="font-semibold text-[var(--text-primary)]">{u.name}</div>
                      <div className="font-mono text-[11px] text-[var(--text-muted)] break-all">{u.email}</div>
                      {u.organization && (
                        <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                          Org: {u.organization} {u.department ? `(${u.department})` : ''}
                        </div>
                      )}
                    </td>

                    {/* Role */}
                    <td className="py-3 px-3 border-r border-[var(--border-subtle)] text-center font-mono text-[11px]">
                      <span className="bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-1.5 py-0.5 uppercase font-semibold">
                        {u.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 border-r border-[var(--border-subtle)] text-center">
                      <span
                        className={`font-mono text-[10px] font-bold px-1.5 py-0.5 border ${
                          u.status === 'APPROVED'
                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--text-primary)]'
                            : u.status === 'SUSPENDED'
                            ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                            : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-color)]'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>

                    {/* Active Permissions */}
                    <td className="py-3 px-4 border-r border-[var(--border-subtle)]">
                      <div className="flex flex-wrap gap-1 text-[11px] font-mono">
                        <span
                          className={`px-1.5 py-0.5 border text-[10px] ${
                            u.permissions?.read
                              ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                              : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-color)] opacity-60'
                          }`}
                        >
                          READ
                        </span>
                        <span
                          className={`px-1.5 py-0.5 border text-[10px] ${
                            u.permissions?.upload
                              ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                              : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-color)] opacity-60'
                          }`}
                        >
                          UPLOAD
                        </span>
                        <span
                          className={`px-1.5 py-0.5 border text-[10px] ${
                            u.permissions?.download
                              ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                              : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-color)] opacity-60'
                          }`}
                        >
                          DOWNLOAD
                        </span>
                        <span
                          className={`px-1.5 py-0.5 border text-[10px] ${
                            u.permissions?.manage
                              ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                              : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-color)] opacity-60'
                          }`}
                        >
                          MANAGE
                        </span>
                      </div>
                    </td>

                    {/* Last Login */}
                    <td className="py-3 px-3 border-r border-[var(--border-subtle)] text-center font-mono text-[11px] text-[var(--text-muted)]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => openEditModal(u)}
                          title="Edit Permissions"
                          className="p-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors border border-transparent hover:border-[var(--border-color)] cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleToggleSuspend(u)}
                          title={u.status === 'SUSPENDED' ? 'Unsuspend User' : 'Suspend User'}
                          className={`p-1.5 transition-colors border border-transparent hover:border-[var(--border-color)] cursor-pointer ${
                            u.status === 'SUSPENDED'
                              ? 'hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] text-[var(--text-primary)]'
                              : 'hover:bg-[var(--bg-hover)] text-[var(--text-muted)]'
                          }`}
                        >
                          {u.status === 'SUSPENDED' ? (
                            <UserCheck className="w-3.5 h-3.5" />
                          ) : (
                            <UserX className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Users Card View (< md) */}
        <div className="block md:hidden divide-y divide-[var(--border-subtle)]">
          {loading ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              Loading user records...
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              No users found matching current filters.
            </div>
          ) : (
            users.map((u, idx) => (
              <div
                key={`mob_user_${u._id}`}
                className={`p-4 space-y-3 transition-colors ${
                  idx % 2 === 1 ? 'bg-[var(--bg-hover)]' : 'bg-[var(--bg-card)]'
                }`}
              >
                {/* User Name & Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-[var(--text-primary)] leading-tight">{u.name}</div>
                    <div className="font-mono text-xs text-[var(--text-muted)] break-all mt-0.5">{u.email}</div>
                    {u.organization && (
                      <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                        Org: {u.organization} {u.department ? `(${u.department})` : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-2 py-0.5 uppercase font-mono text-[10px] font-semibold">
                      {u.role}
                    </span>
                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 border ${
                        u.status === 'APPROVED'
                          ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--text-primary)]'
                          : u.status === 'SUSPENDED'
                          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                          : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-color)]'
                      }`}
                    >
                      {u.status}
                    </span>
                  </div>
                </div>

                {/* Permissions & Last Login */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)] text-[11px]">
                  <div className="flex flex-wrap gap-1 font-mono">
                    <span
                      className={`px-1.5 py-0.5 border text-[9px] ${
                        u.permissions?.read
                          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                          : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-color)] opacity-60'
                      }`}
                    >
                      READ
                    </span>
                    <span
                      className={`px-1.5 py-0.5 border text-[9px] ${
                        u.permissions?.upload
                          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                          : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-color)] opacity-60'
                      }`}
                    >
                      UPLOAD
                    </span>
                    <span
                      className={`px-1.5 py-0.5 border text-[9px] ${
                        u.permissions?.download
                          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                          : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-color)] opacity-60'
                      }`}
                    >
                      DOWNLOAD
                    </span>
                    <span
                      className={`px-1.5 py-0.5 border text-[9px] ${
                        u.permissions?.manage
                          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                          : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-color)] opacity-60'
                      }`}
                    >
                      MANAGE
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-[var(--text-muted)]">
                    Last: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                  </div>
                </div>

                {/* Mobile Action Buttons (Touch Friendly: min-h-[44px]) */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => openEditModal(u)}
                    className="flex-1 min-h-[44px] px-3 py-2 text-xs font-semibold flex items-center justify-center space-x-1.5 border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Permissions</span>
                  </button>
                  <button
                    onClick={() => handleToggleSuspend(u)}
                    className={`min-h-[44px] px-4 py-2 text-xs font-semibold flex items-center justify-center space-x-1.5 border border-[var(--border-color)] cursor-pointer ${
                      u.status === 'SUSPENDED'
                        ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                        : 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                    }`}
                  >
                    {u.status === 'SUSPENDED' ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Unsuspend</span>
                      </>
                    ) : (
                      <>
                        <UserX className="w-3.5 h-3.5" />
                        <span>Suspend</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--modal-bg)] border border-[var(--border-color)] max-w-md w-full shadow-2xl max-h-[92vh] flex flex-col">
            <div className="bg-[var(--table-header-bg)] text-[var(--table-header-text)] px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-2">
                <h3 className="font-semibold text-sm truncate">Update User Permissions</h3>
                <p className="text-[11px] opacity-75 truncate">{editingUser.email}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="opacity-75 hover:opacity-100 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-4 text-xs overflow-y-auto">
              <div>
                <label className="block text-[var(--text-secondary)] mb-1 font-medium">User Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] p-2 text-xs focus:outline-none focus:border-[var(--text-primary)]"
                >
                  <option value="USER">USER (Standard Consumer)</option>
                  <option value="MANAGER">MANAGER (Contributor & Editor)</option>
                  <option value="ADMIN">ADMIN (Full Administrator)</option>
                </select>
              </div>

              <div>
                <label className="block text-[var(--text-secondary)] mb-1 font-medium">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] p-2 text-xs focus:outline-none focus:border-[var(--text-primary)]"
                >
                  <option value="APPROVED">APPROVED (Authorized)</option>
                  <option value="PENDING">PENDING (Under Review)</option>
                  <option value="SUSPENDED">SUSPENDED (Locked Out)</option>
                  <option value="REJECTED">REJECTED (Declined)</option>
                </select>
              </div>

              {/* PERMISSION CHECKBOXES */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-[11px] text-[var(--text-primary)] mb-2">
                  Permission Matrix:
                </label>
                <div className="space-y-2">
                  <label className="flex items-center justify-between border border-[var(--border-color)] p-2.5 bg-[var(--bg-hover)] cursor-pointer">
                    <span className="font-bold text-xs text-[var(--text-primary)]">READ ACCESS</span>
                    <input
                      type="checkbox"
                      checked={editPerms.read}
                      onChange={(e) => setEditPerms({ ...editPerms, read: e.target.checked })}
                      className="accent-[var(--text-primary)] w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between border border-[var(--border-color)] p-2.5 bg-[var(--bg-hover)] cursor-pointer">
                    <span className="font-bold text-xs text-[var(--text-primary)]">UPLOAD ACCESS</span>
                    <input
                      type="checkbox"
                      checked={editPerms.upload}
                      onChange={(e) => setEditPerms({ ...editPerms, upload: e.target.checked })}
                      className="accent-[var(--text-primary)] w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between border border-[var(--border-color)] p-2.5 bg-[var(--bg-hover)] cursor-pointer">
                    <span className="font-bold text-xs text-[var(--text-primary)]">DOWNLOAD ACCESS</span>
                    <input
                      type="checkbox"
                      checked={editPerms.download}
                      onChange={(e) => setEditPerms({ ...editPerms, download: e.target.checked })}
                      className="accent-[var(--text-primary)] w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between border border-[var(--border-color)] p-2.5 bg-[var(--bg-hover)] cursor-pointer">
                    <span className="font-bold text-xs text-[var(--text-primary)]">MANAGE ACCESS</span>
                    <input
                      type="checkbox"
                      checked={editPerms.manage}
                      onChange={(e) => setEditPerms({ ...editPerms, manage: e.target.checked })}
                      className="accent-[var(--text-primary)] w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div className="border-t border-[var(--border-subtle)] pt-3 flex items-center justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={saving}
                  className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[var(--text-primary)] text-[var(--bg-primary)] font-semibold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
