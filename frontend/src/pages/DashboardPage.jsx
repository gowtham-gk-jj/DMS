import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderTree,
  FileText,
  ShieldCheck,
  HardDrive,
  ArrowRight,
  RotateCw,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [folders, setFolders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [foldersError, setFoldersError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setFoldersLoading(true);
      }
      setFoldersError(null);

      const foldersRes = await api.get('/folders?parentId=root');

      if (foldersRes.data.success) {
        setFolders(foldersRes.data.folders || []);
      } else {
        setFoldersError('Failed to load primary document repositories.');
      }

      // If admin, load dashboard statistics
      if (isAdmin) {
        const statsRes = await api.get('/admin/stats');
        if (statsRes.data.success) {
          setStats(statsRes.data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setFoldersError('Network error while fetching repository document metrics.');
    } finally {
      setLoading(false);
      setFoldersLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Auto-refresh when tab receives focus
    const handleFocus = () => {
      loadDashboardData(true);
    };

    const handleStorageEvent = (e) => {
      if (e.key === 'dms_data_updated') {
        loadDashboardData(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [isAdmin]);

  const permissions = isAdmin
    ? { read: true, upload: true, download: true, manage: true }
    : user?.permissions || {};

  if (loading && folders.length === 0) {
    return (
      <div className="p-12 text-center text-xs font-mono text-[var(--text-muted)] dms-card">
        Loading dashboard repositories and technical document statistics...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome & System Status Bar */}
      <div className="dms-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
            ENTERPRISE DOCUMENT MANAGEMENT SYSTEM • SIEMENS DOConCD
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Welcome back, {user?.name}
          </h1>
          <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
            Access authorized technical specifications, SINUMERIK CNC manuals, and SINAMICS drive documentation.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => navigate('/library')}
            className="dms-btn-primary w-full sm:w-auto px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
          >
            <FolderTree className="w-4 h-4" />
            <span>Browse Library</span>
          </button>
        </div>
      </div>

      {/* Metric Cards: 1 column on mobile, 2 on tablet, 4 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1 */}
        <div className="dms-card p-4 transition-all">
          <div className="text-xs font-medium flex items-center justify-between text-[var(--text-secondary)]">
            <span>Root Repositories</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]">
              <FolderTree className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-2">
            {folders.length}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Standard Siemens catalogues
          </div>
        </div>

        {/* Card 2 */}
        <div className="dms-card p-4 transition-all">
          <div className="text-xs font-medium flex items-center justify-between text-[var(--text-secondary)]">
            <span>Indexed Documents</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-2">
            {stats
              ? stats.totalDocuments
              : folders.reduce((acc, f) => acc + (f.documentsCount || 0), 0) || '—'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            {stats ? 'Total active system manuals' : 'Indexed technical documents'}
          </div>
        </div>

        {/* Card 3 */}
        <div className="dms-card p-4 transition-all">
          <div className="text-xs font-medium flex items-center justify-between text-[var(--text-secondary)]">
            <span>Cloudinary Storage</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-2">
            {stats ? stats.storageFormatted : 'Connected'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
            Bucket: <strong className="font-semibold text-[var(--text-secondary)]">we355whf</strong>
          </div>
        </div>

        {/* Card 4 */}
        <div className="dms-card p-4 transition-all">
          <div className="text-xs font-medium flex items-center justify-between text-[var(--text-secondary)]">
            <span>Your Permissions</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-center space-x-1.5 mt-2.5 text-xs font-mono font-semibold">
            <span
              className={`px-1.5 py-0.5 rounded-xs text-[11px] ${
                permissions.read
                  ? 'bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-color)]'
              }`}
              title="Read Permission"
            >
              R
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-xs text-[11px] ${
                permissions.upload
                  ? 'bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-color)]'
              }`}
              title="Upload Permission"
            >
              U
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-xs text-[11px] ${
                permissions.download
                  ? 'bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-color)]'
              }`}
              title="Download Permission"
            >
              D
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-xs text-[11px] ${
                permissions.manage
                  ? 'bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-color)]'
              }`}
              title="Manage Permission"
            >
              M
            </span>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1.5">
            {isAdmin ? 'Full Administrative Access' : 'Authorized Enterprise Role'}
          </div>
        </div>
      </div>

      {/* Main Document Repositories */}
      <div className="dms-card overflow-hidden">
        <div className="border-b border-[var(--border-color)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-elevated)]">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] font-mono">
                Primary Document Repositories
              </h2>
              {refreshing && (
                <span className="text-[10px] font-mono text-[var(--primary-blue)] animate-pulse">
                  Syncing live metrics...
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Siemens DOConCD nested catalogues, technical archives, and system manuals
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => loadDashboardData(true)}
              disabled={refreshing || foldersLoading}
              title="Refresh repository document counts from database"
              className="dms-btn-secondary px-3 py-1.5 min-h-[36px] text-xs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[var(--primary-blue)]' : ''}`} />
              <span className="text-[11px]">Sync Counts</span>
            </button>
            <button
              onClick={() => navigate('/library')}
              className="dms-btn-secondary px-3 py-1.5 min-h-[36px] text-xs text-[var(--primary-blue)]"
            >
              <span>View All Folders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {foldersError ? (
          <div className="p-6 text-center text-xs m-4 rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)]">
            <AlertCircle className="w-5 h-5 mx-auto mb-1 text-[var(--color-error)]" />
            <p className="font-semibold">{foldersError}</p>
            <button
              onClick={() => loadDashboardData(true)}
              className="mt-2 text-xs underline font-medium hover:opacity-80 cursor-pointer"
            >
              Retry Database Fetch
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {folders.map((folder) => {
              const docCount = folder.totalDocumentsCount ?? folder.documentsCount;
              const subCount = folder.totalSubfoldersCount ?? folder.subfoldersCount;

              return (
                <div
                  key={folder._id}
                  onClick={() => navigate(`/library/${folder._id}`)}
                  className="dms-card-interactive p-4 sm:p-5 cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] flex items-center justify-center shrink-0 text-[var(--primary-blue)] group-hover:bg-[var(--primary-subtle)] group-hover:border-[var(--primary-border)] transition-colors">
                        <FolderTree className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--primary-blue)] transition-colors">
                          {folder.name}
                        </h3>
                        <span className="text-[11px] font-mono text-[var(--text-muted)] block truncate mt-0.5">
                          {folder.code || folder.path}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--primary-blue)] group-hover:translate-x-1 transition-all" />
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] mt-3 leading-relaxed line-clamp-2">
                    {folder.description || 'Enterprise document collection and technical reference.'}
                  </p>

                  <div className="border-t border-[var(--border-subtle)] mt-3.5 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                    <div className="flex items-center space-x-3">
                      <span>
                        <strong className="text-[var(--text-primary)] font-mono">
                          {foldersLoading ? (
                            <span className="inline-block w-4 h-3 bg-gray-400/20 animate-pulse rounded" />
                          ) : subCount !== undefined ? (
                            subCount
                          ) : (
                            <span className="text-amber-500">0</span>
                          )}
                        </strong>{' '}
                        Categories
                      </span>
                      <span>•</span>
                      <span>
                        <strong className="text-[var(--text-primary)] font-mono">
                          {foldersLoading ? (
                            <span className="inline-block w-6 h-3 bg-gray-400/20 animate-pulse rounded" />
                          ) : docCount !== undefined ? (
                            docCount
                          ) : (
                            <span className="text-amber-500">0</span>
                          )}
                        </strong>{' '}
                        Documents
                      </span>
                    </div>
                    <span className="font-medium text-[var(--primary-blue)] group-hover:underline inline-flex items-center gap-1 text-[11px]">
                      <span>Browse Table</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
