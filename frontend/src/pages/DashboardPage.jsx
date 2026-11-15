import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  FolderTree,
  FileText,
  ShieldCheck,
  HardDrive,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { openDocument } = useOutletContext() || {};

  const [folders, setFolders] = useState([]);
  const [recentDocs, setRecentDocs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const [foldersRes, recentRes] = await Promise.all([
          api.get('/folders?parentId=root'),
          api.get('/documents/recent?limit=6'),
        ]);

        if (foldersRes.data.success) {
          setFolders(foldersRes.data.folders || []);
        }
        if (recentRes.data.success) {
          setRecentDocs(recentRes.data.documents || []);
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
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [isAdmin]);

  const permissions = isAdmin
    ? { read: true, upload: true, download: true, manage: true }
    : user?.permissions || {};

  if (loading && folders.length === 0) {
    return (
      <div
        className={`p-8 sm:p-12 text-center text-xs font-mono border transition-colors ${
          isDark
            ? 'bg-[#141c2b] border-[#243042] text-[#94a3b8]'
            : 'bg-[#ffffff] border-[#e5e5e5] text-[#777777]'
        }`}
      >
        Loading dashboard repositories and technical document statistics...
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Welcome & System Status Bar */}
      <div
        className={`border p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
          isDark
            ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
            : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
        }`}
      >
        <div>
          <div
            className={`text-[10px] sm:text-[11px] font-mono uppercase tracking-wider ${
              isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
            }`}
          >
            ENTERPRISE DOCUMENT MANAGEMENT SYSTEM • SIEMENS DOConCD
          </div>
          <h1
            className={`text-lg sm:text-xl font-bold tracking-tight mt-1 ${
              isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
            }`}
          >
            Welcome back, {user?.name}
          </h1>
          <p
            className={`text-xs mt-1 ${
              isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
            }`}
          >
            Access authorized technical specifications, SINUMERIK CNC manuals, and SINAMICS drive documentation.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => navigate('/library')}
            className={`w-full sm:w-auto px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
              isDark
                ? 'bg-[#f8fafc] text-[#0b0f17] hover:bg-[#e2e8f0]'
                : 'bg-[#111111] text-[#ffffff] hover:bg-[#333333]'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Browse Library</span>
          </button>
        </div>
      </div>

      {/* Metric Cards: 1 column on mobile, 2 on tablet, 4 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1 */}
        <div
          className={`border p-4 transition-colors ${
            isDark
              ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
              : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
          }`}
        >
          <div
            className={`text-[11px] font-medium flex items-center justify-between ${
              isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
            }`}
          >
            <span>Root Repositories</span>
            <FolderTree
              className={`w-3.5 h-3.5 ${isDark ? 'text-[#60a5fa]' : 'text-[#111111]'}`}
            />
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-2 ${
              isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
            }`}
          >
            {folders.length}
          </div>
          <div
            className={`text-[10px] mt-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}
          >
            Standard Siemens catalogues
          </div>
        </div>

        {/* Card 2 */}
        <div
          className={`border p-4 transition-colors ${
            isDark
              ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
              : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
          }`}
        >
          <div
            className={`text-[11px] font-medium flex items-center justify-between ${
              isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
            }`}
          >
            <span>Indexed Documents</span>
            <FileText
              className={`w-3.5 h-3.5 ${isDark ? 'text-[#60a5fa]' : 'text-[#111111]'}`}
            />
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-2 ${
              isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
            }`}
          >
            {stats ? stats.totalDocuments : '186'}
          </div>
          <div
            className={`text-[10px] mt-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}
          >
            DOConCD catalogue records
          </div>
        </div>

        {/* Card 3 */}
        <div
          className={`border p-4 transition-colors ${
            isDark
              ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
              : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
          }`}
        >
          <div
            className={`text-[11px] font-medium flex items-center justify-between ${
              isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
            }`}
          >
            <span>Cloudinary Storage</span>
            <HardDrive
              className={`w-3.5 h-3.5 ${isDark ? 'text-[#60a5fa]' : 'text-[#111111]'}`}
            />
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-2 ${
              isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
            }`}
          >
            {stats ? stats.storageFormatted : 'Connected'}
          </div>
          <div
            className={`text-[10px] mt-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}
          >
            Asset bucket: <strong>we355whf</strong>
          </div>
        </div>

        {/* Card 4 */}
        <div
          className={`border p-4 transition-colors ${
            isDark
              ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
              : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
          }`}
        >
          <div
            className={`text-[11px] font-medium flex items-center justify-between ${
              isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
            }`}
          >
            <span>Your Permissions</span>
            <ShieldCheck
              className={`w-3.5 h-3.5 ${isDark ? 'text-[#60a5fa]' : 'text-[#111111]'}`}
            />
          </div>
          <div className="flex items-center space-x-1 mt-2 text-[11px] font-mono font-semibold">
            <span
              className={
                permissions.read
                  ? isDark
                    ? 'text-[#f8fafc]'
                    : 'text-[#111111]'
                  : 'text-[#64748b]'
              }
            >
              R
            </span>
            <span className={isDark ? 'text-[#64748b]' : 'text-[#cccccc]'}>•</span>
            <span
              className={
                permissions.upload
                  ? isDark
                    ? 'text-[#f8fafc]'
                    : 'text-[#111111]'
                  : 'text-[#64748b]'
              }
            >
              U
            </span>
            <span className={isDark ? 'text-[#64748b]' : 'text-[#cccccc]'}>•</span>
            <span
              className={
                permissions.download
                  ? isDark
                    ? 'text-[#f8fafc]'
                    : 'text-[#111111]'
                  : 'text-[#64748b]'
              }
            >
              D
            </span>
            <span className={isDark ? 'text-[#64748b]' : 'text-[#cccccc]'}>•</span>
            <span
              className={
                permissions.manage
                  ? isDark
                    ? 'text-[#f8fafc]'
                    : 'text-[#111111]'
                  : 'text-[#64748b]'
              }
            >
              M
            </span>
          </div>
          <div
            className={`text-[10px] mt-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}
          >
            {isAdmin ? 'Full Root Admin' : 'Authorized Role'}
          </div>
        </div>
      </div>

      {/* Main Document Repositories */}
      <div
        className={`border transition-colors ${
          isDark ? 'bg-[#141c2b] border-[#243042]' : 'bg-[#ffffff] border-[#e5e5e5]'
        }`}
      >
        <div
          className={`border-b p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            isDark ? 'bg-[#111827] border-[#243042]' : 'bg-[#fafafa] border-[#e5e5e5]'
          }`}
        >
          <div>
            <h2
              className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
              }`}
            >
              Primary Document Repositories
            </h2>
            <p className={`text-[11px] ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
              Siemens DOConCD nested catalogues and technical archives
            </p>
          </div>
          <button
            onClick={() => navigate('/library')}
            className={`text-xs font-medium hover:underline flex items-center space-x-1 cursor-pointer self-start sm:self-auto ${
              isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
            }`}
          >
            <span>View All Folders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {folders.map((folder) => (
            <div
              key={folder._id}
              onClick={() => navigate(`/library/${folder._id}`)}
              className={`border p-4 cursor-pointer transition-all group ${
                isDark
                  ? 'bg-[#0f172a] border-[#243042] hover:border-[#60a5fa]'
                  : 'bg-[#ffffff] border-[#e5e5e5] hover:border-[#111111]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 border flex items-center justify-center shrink-0 transition-colors ${
                      isDark
                        ? 'bg-[#1e293b] border-[#334155] text-[#60a5fa] group-hover:bg-[#f8fafc] group-hover:text-[#0b0f17]'
                        : 'bg-[#f5f5f5] border-[#e5e5e5] text-[#111111] group-hover:bg-[#111111] group-hover:text-[#ffffff]'
                    }`}
                  >
                    <FolderTree className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3
                      className={`font-semibold text-xs truncate group-hover:underline ${
                        isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                      }`}
                    >
                      {folder.name}
                    </h3>
                    <span
                      className={`text-[10px] font-mono block truncate ${
                        isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                      }`}
                    >
                      {folder.code || folder.path}
                    </span>
                  </div>
                </div>
                <ArrowRight
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isDark
                      ? 'text-[#64748b] group-hover:text-[#f8fafc]'
                      : 'text-[#cccccc] group-hover:text-[#111111]'
                  }`}
                />
              </div>

              <p
                className={`text-xs mt-3 leading-relaxed ${
                  isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                }`}
              >
                {folder.description || 'Enterprise document collection and technical reference.'}
              </p>

              <div
                className={`border-t mt-3 pt-2.5 flex items-center justify-between text-[11px] ${
                  isDark
                    ? 'border-[#1e293b] text-[#94a3b8]'
                    : 'border-[#f0f0f0] text-[#777777]'
                }`}
              >
                <span>
                  <strong className={isDark ? 'text-[#f8fafc]' : 'text-[#111111]'}>
                    {folder.subfoldersCount || 0}
                  </strong>{' '}
                  Subcategories
                </span>
                <span>
                  <strong className={isDark ? 'text-[#f8fafc]' : 'text-[#111111]'}>
                    {folder.documentsCount || 0}
                  </strong>{' '}
                  Documents
                </span>
                <span
                  className={`font-medium group-hover:underline ${
                    isDark ? 'text-[#60a5fa]' : 'text-[#111111]'
                  }`}
                >
                  Browse Table →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recently Catalogued Documents */}
      <div
        className={`border transition-colors ${
          isDark ? 'bg-[#141c2b] border-[#243042]' : 'bg-[#ffffff] border-[#e5e5e5]'
        }`}
      >
        <div
          className={`border-b p-3.5 sm:p-4 flex items-center justify-between ${
            isDark ? 'bg-[#111827] border-[#243042]' : 'bg-[#fafafa] border-[#e5e5e5]'
          }`}
        >
          <div>
            <h2
              className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
              }`}
            >
              Recently Catalogued Documents
            </h2>
            <p className={`text-[11px] ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
              Click any document to inspect in the integrated in-app viewer
            </p>
          </div>
          <span
            className={`text-xs font-mono ${
              isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
            }`}
          >
            {recentDocs.length} ENTRIES
          </span>
        </div>

        <div
          className={`divide-y ${
            isDark ? 'divide-[#243042]' : 'divide-[#e5e5e5]'
          }`}
        >
          {recentDocs.length === 0 ? (
            <div
              className={`p-8 text-center text-xs ${
                isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
              }`}
            >
              No documents catalogued yet.
            </div>
          ) : (
            recentDocs.map((doc) => (
              <div
                key={doc._id}
                onClick={() => openDocument && openDocument(doc)}
                className={`p-3.5 cursor-pointer flex items-center justify-between transition-colors text-xs group ${
                  isDark ? 'hover:bg-[#1e293b]' : 'hover:bg-[#f9f9f9]'
                }`}
              >
                <div className="flex items-center space-x-3 truncate mr-2 sm:mr-4 min-w-0">
                  <FileText
                    className={`w-4 h-4 shrink-0 ${
                      isDark ? 'text-[#60a5fa]' : 'text-[#777777]'
                    }`}
                  />
                  <div className="truncate min-w-0">
                    <div
                      className={`font-medium group-hover:underline truncate ${
                        isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                      }`}
                    >
                      {doc.title}
                    </div>
                    <div
                      className={`flex flex-wrap items-center gap-1.5 text-[11px] mt-0.5 ${
                        isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                      }`}
                    >
                      {doc.system && (
                        <span
                          className={`border px-1 py-0.2 font-mono text-[10px] ${
                            isDark
                              ? 'bg-[#1e293b] text-[#f8fafc] border-[#334155]'
                              : 'bg-[#f5f5f5] text-[#111111] border-[#e5e5e5]'
                          }`}
                        >
                          {doc.system}
                        </span>
                      )}
                      {doc.fileName && (
                        <span
                          className={`font-mono font-semibold ${
                            isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                          }`}
                        >
                          {doc.fileName}
                        </span>
                      )}
                      {doc.category && <span className="truncate">• {doc.category}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 text-xs">
                  <span
                    className={`font-mono text-[11px] hidden sm:inline ${
                      isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                    }`}
                  >
                    {doc.fileExtension?.toUpperCase()}
                  </span>
                  <span
                    className={`border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      isDark
                        ? 'border-[#334155] text-[#f8fafc] group-hover:bg-[#f8fafc] group-hover:text-[#0b0f17]'
                        : 'border-[#111111] text-[#111111] group-hover:bg-[#111111] group-hover:text-[#ffffff]'
                    }`}
                  >
                    Preview
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
