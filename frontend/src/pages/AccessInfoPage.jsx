import React from 'react';
import { ShieldCheck, UserCheck, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AccessInfoPage() {
  const { user, isAdmin } = useAuth();

  const permissions = isAdmin
    ? { read: true, upload: true, download: true, manage: true }
    : user?.permissions || {};

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-1 sm:px-0 pb-16">
      {/* Header Banner */}
      <div className="dms-card p-5 sm:p-6">
        <div className="flex items-center space-x-2 text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
          <span>ACCOUNT & PERMISSION PROFILE</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Access Information
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Review your authenticated identity, verified organization, and granular permissions enforced by the backend security layer.
        </p>
      </div>

      {/* Profile & Organization Details */}
      <div className="dms-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-[var(--border-subtle)] pb-3">
          <UserCheck className="w-4 h-4 text-blue-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Identity Profile
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg p-3.5">
            <span className="text-[var(--text-muted)] block text-[11px] font-medium">Full Name</span>
            <span className="font-semibold text-sm text-[var(--text-primary)] mt-0.5 block">{user?.name}</span>
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg p-3.5">
            <span className="text-[var(--text-muted)] block text-[11px] font-medium">Google Account Email</span>
            <span className="font-mono text-xs text-[var(--text-primary)] break-all mt-0.5 block">{user?.email}</span>
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg p-3.5">
            <span className="text-[var(--text-muted)] block text-[11px] font-medium">Assigned Role</span>
            <div className="mt-1">
              <span className="dms-badge dms-badge-info font-mono text-xs uppercase">
                {user?.role}
              </span>
            </div>
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg p-3.5">
            <span className="text-[var(--text-muted)] block text-[11px] font-medium">Approval Status</span>
            <div className="mt-1">
              <span className="dms-badge dms-badge-success font-mono text-xs uppercase">
                {user?.status}
              </span>
            </div>
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg p-3.5">
            <span className="text-[var(--text-muted)] block text-[11px] font-medium">Organization / Company</span>
            <span className="font-medium text-xs text-[var(--text-primary)] mt-0.5 block">{user?.organization || 'Engineering Division'}</span>
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg p-3.5">
            <span className="text-[var(--text-muted)] block text-[11px] font-medium">Department / Unit</span>
            <span className="font-medium text-xs text-[var(--text-primary)] mt-0.5 block">{user?.department || 'Systems Architecture'}</span>
          </div>
        </div>
      </div>

      {/* Granular Permission Entitlements */}
      <div className="dms-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-[var(--border-subtle)] pb-3">
          <Key className="w-4 h-4 text-blue-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Effective Permissions Matrix
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="dms-card p-4 bg-[var(--bg-elevated)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-[var(--text-primary)]">Read Access</span>
              <span
                className={`dms-badge font-mono text-[11px] font-bold ${
                  permissions.read ? 'dms-badge-success' : 'dms-badge-neutral'
                }`}
              >
                {permissions.read ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Permission to browse repositories, view DOConCD catalogues, and inspect documents inside the embedded viewer.
            </p>
          </div>

          <div className="dms-card p-4 bg-[var(--bg-elevated)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-[var(--text-primary)]">Upload Access</span>
              <span
                className={`dms-badge font-mono text-[11px] font-bold ${
                  permissions.upload ? 'dms-badge-success' : 'dms-badge-neutral'
                }`}
              >
                {permissions.upload ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Permission to upload new technical specifications and manuals to authorized repository folders.
            </p>
          </div>

          <div className="dms-card p-4 bg-[var(--bg-elevated)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-[var(--text-primary)]">Download Access</span>
              <span
                className={`dms-badge font-mono text-[11px] font-bold ${
                  permissions.download ? 'dms-badge-success' : 'dms-badge-neutral'
                }`}
              >
                {permissions.download ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Permission to export and download raw document binaries, PDFs, and CAD archives to local storage.
            </p>
          </div>

          <div className="dms-card p-4 bg-[var(--bg-elevated)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-[var(--text-primary)]">Management Access</span>
              <span
                className={`dms-badge font-mono text-[11px] font-bold ${
                  permissions.manage ? 'dms-badge-success' : 'dms-badge-neutral'
                }`}
              >
                {permissions.manage ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Permission to create folders, edit document metadata, move documents, and manage catalogue entries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
