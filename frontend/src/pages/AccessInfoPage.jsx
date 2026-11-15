import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AccessInfoPage() {
  const { user, isAdmin } = useAuth();

  const permissions = isAdmin
    ? { read: true, upload: true, download: true, manage: true }
    : user?.permissions || {};

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-1 sm:px-0">
      {/* Header Banner */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-xs transition-colors">
        <div className="flex items-center space-x-2 text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>ACCOUNT & PERMISSION PROFILE</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
          Access Information
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Review your authenticated identity, verified organization, and granular permissions enforced by the backend security layer.
        </p>
      </div>

      {/* Profile & Organization Details */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5 transition-colors">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4 border-b border-[var(--border-subtle)] pb-2">
          Identity Profile
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[var(--text-muted)] block text-[11px]">Full Name:</span>
            <span className="font-semibold text-sm text-[var(--text-primary)]">{user?.name}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block text-[11px]">Google Account Email:</span>
            <span className="font-mono text-xs text-[var(--text-primary)] break-all">{user?.email}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block text-[11px]">Assigned Role:</span>
            <span className="font-mono font-bold text-xs uppercase bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-primary)] px-2 py-0.5 inline-block mt-0.5">
              {user?.role}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block text-[11px]">Approval Status:</span>
            <span className="font-mono font-bold text-xs uppercase bg-[var(--bg-hover)] border border-[var(--border-color)] px-2 py-0.5 inline-block mt-0.5 text-[var(--text-primary)]">
              {user?.status}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block text-[11px]">Organization / Company:</span>
            <span className="font-medium text-[var(--text-primary)]">{user?.organization || 'Engineering Division'}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block text-[11px]">Department / Unit:</span>
            <span className="font-medium text-[var(--text-primary)]">{user?.department || 'Systems Architecture'}</span>
          </div>
        </div>
      </div>

      {/* Granular Permission Entitlements */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5 transition-colors">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4 border-b border-[var(--border-subtle)] pb-2">
          Effective Permissions Matrix
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="border border-[var(--border-color)] p-3.5 bg-[var(--bg-hover)]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-primary)]">Read Access</span>
              <span
                className={`font-mono text-[11px] font-bold px-2 py-0.5 ${
                  permissions.read
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                    : 'bg-[var(--border-color)] text-[var(--text-muted)]'
                }`}
              >
                {permissions.read ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
              Permission to browse folders, view DOConCD catalogues, and inspect documents inside the embedded viewer.
            </p>
          </div>

          <div className="border border-[var(--border-color)] p-3.5 bg-[var(--bg-hover)]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-primary)]">Upload Access</span>
              <span
                className={`font-mono text-[11px] font-bold px-2 py-0.5 ${
                  permissions.upload
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                    : 'bg-[var(--border-color)] text-[var(--text-muted)]'
                }`}
              >
                {permissions.upload ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
              Permission to upload new technical specifications and manuals to authorized repository folders.
            </p>
          </div>

          <div className="border border-[var(--border-color)] p-3.5 bg-[var(--bg-hover)]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-primary)]">Download Access</span>
              <span
                className={`font-mono text-[11px] font-bold px-2 py-0.5 ${
                  permissions.download
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                    : 'bg-[var(--border-color)] text-[var(--text-muted)]'
                }`}
              >
                {permissions.download ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
              Permission to export and download raw document binaries, PDFs, and CAD archives to local storage.
            </p>
          </div>

          <div className="border border-[var(--border-color)] p-3.5 bg-[var(--bg-hover)]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-primary)]">Management Access</span>
              <span
                className={`font-mono text-[11px] font-bold px-2 py-0.5 ${
                  permissions.manage
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                    : 'bg-[var(--border-color)] text-[var(--text-muted)]'
                }`}
              >
                {permissions.manage ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
              Permission to create folders, edit document metadata, move documents, and delete catalogue records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
