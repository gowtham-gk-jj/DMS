import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  FolderTree,
  FolderPlus,
  Upload,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  AlertCircle,
} from 'lucide-react';
import DOConCDTable, { SIMODRIVE_CATEGORY_ORDER } from '../components/DOConCDTable';
import UploadModal from '../components/UploadModal';
import CreateFolderModal from '../components/CreateFolderModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

// Exact Siemens DOConCD PDF Category Ordering
const PDF_CATEGORY_ORDER = [
  'DOConCD SINUMERIK - SINAMICS 09/2011 English',
  '840D sl / 840Di sl / 828D User',
  'Operation',
  'Programming',
  '840D sl Manufacturer / Service',
  'Configuring',
  'Commissioning',
  'Functions',
  '828D Manufacturer / Service',
  'Version 4.3',
  'Version 2.6',
  '802D sl',
  'User',
  'Manufacturer / Service',
  'SINAMICS S120',
  'Measuring Systems',
  'Synchronous Motors',
  'Asynchronous Motors',
  'Linear / Torque Motors',
  'Motion Control Information System',
  'ePS Network Services',
  'SIMATIC',
  'Info / Training',
  'Control System Overview',
];

export default function LibraryPage() {
  const { folderId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { isDark } = useTheme();
  const { openDocument } = useOutletContext() || {};

  const [currentFolder, setCurrentFolder] = useState(null);
  const [subfolders, setSubfolders] = useState([]);
  const [isFoldersExpanded, setIsFoldersExpanded] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [groupedByCategory, setGroupedByCategory] = useState({});
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableSystems, setAvailableSystems] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);

  const fetchLibraryData = async () => {
    try {
      setLoading(true);
      setError('');

      const sortFolders = (list, isSim = false) => {
        const order = isSim ? SIMODRIVE_CATEGORY_ORDER : PDF_CATEGORY_ORDER;
        return [...list].sort((a, b) => {
          const idxA = order.indexOf(a.name);
          const idxB = order.indexOf(b.name);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.name.localeCompare(b.name);
        });
      };

      if (!folderId || folderId === 'root') {
        // Fetch root level folders
        const res = await api.get('/folders?parentId=root');
        if (res.data.success) {
          setSubfolders(res.data.folders || []);
          setCurrentFolder(null);
          setDocuments([]);
          setBreadcrumbs([{ name: 'Document Library', id: 'root' }]);
        }
      } else {
        // Fetch folder details, subfolders, and documents without pagination truncation
        const [folderRes, subfoldersRes, docsRes] = await Promise.all([
          api.get(`/folders/${folderId}`),
          api.get(`/folders?parentId=${folderId}`),
          api.get(`/documents/folder/${folderId}?limit=1000`),
        ]);

        const folderObj = folderRes.data.folder;
        const breadcrumbList = folderRes.data.breadcrumbs || [];
        const isSim = Boolean(
          folderObj?.name?.includes('SIMODRIVE') ||
          breadcrumbList.some((b) => b.name?.includes('SIMODRIVE')) ||
          folderObj?.code === 'SIMODRIVE'
        );

        if (folderRes.data.success) {
          setCurrentFolder(folderObj);
          setBreadcrumbs(breadcrumbList);
        }

        if (subfoldersRes.data.success) {
          setSubfolders(sortFolders(subfoldersRes.data.folders || [], isSim));
        }

        if (docsRes.data.success) {
          setDocuments(docsRes.data.documents || []);
          setGroupedByCategory(docsRes.data.groupedByCategory || {});
          setAvailableCategories(docsRes.data.availableCategories || []);
          setAvailableSystems(docsRes.data.availableSystems || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch folder contents:', err);
      setError(err.response?.data?.message || 'Failed to load folder contents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsFoldersExpanded(false);
    fetchLibraryData();
  }, [folderId]);

  // If URL has ?doc=id query param, automatically open that document
  useEffect(() => {
    const docId = searchParams.get('doc');
    if (docId && documents.length > 0) {
      const target = documents.find((d) => d._id === docId);
      if (target && openDocument) {
        openDocument(target);
      }
    }
  }, [searchParams, documents, openDocument]);

  const permissions = isAdmin
    ? { read: true, upload: true, download: true, manage: true }
    : currentFolder?.userPermissions || user?.permissions || {};

  const handleDownload = async (doc) => {
    try {
      const res = await api.get(`/documents/${doc._id}/download?stream=true`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: doc.mimeType || 'application/octet-stream',
      });
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = doc.originalFileName || `${doc.title || 'document'}.pdf`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert(err.response?.data?.message || 'Download failed or permission denied.');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Breadcrumb Path */}
      <div
        className={`border p-4 sm:p-5 shadow-xs transition-colors duration-150 ${
          isDark
            ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
            : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            {/* Breadcrumb Trail */}
            <div
              className={`flex flex-wrap items-center gap-1.5 text-xs mb-1 font-mono ${
                isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
              }`}
            >
              <button
                onClick={() => navigate('/library')}
                className={`hover:underline cursor-pointer ${
                  isDark ? 'hover:text-[#f8fafc]' : 'hover:text-[#111111]'
                }`}
              >
                DOCUMENT LIBRARY
              </button>
              {breadcrumbs.map((b) => (
                <React.Fragment key={b.id || b.name}>
                  <ChevronRight
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isDark ? 'text-[#475569]' : 'text-[#cccccc]'
                    }`}
                  />
                  <button
                    onClick={() => navigate(`/library/${b.id}`)}
                    className={`hover:underline cursor-pointer truncate max-w-[150px] ${
                      isDark ? 'hover:text-[#f8fafc]' : 'hover:text-[#111111]'
                    }`}
                  >
                    {b.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            <h1
              className={`text-lg sm:text-xl font-bold tracking-tight ${
                isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
              }`}
            >
              {currentFolder ? currentFolder.name : 'Engineering Document Library'}
            </h1>
            <p
              className={`text-xs mt-0.5 ${
                isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
              }`}
            >
              {currentFolder?.description ||
                'Browse root document catalogues, nested subcategories, and DOConCD technical manuals.'}
            </p>
          </div>

          {/* Action Buttons: Upload & New Subfolder */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {folderId && folderId !== 'root' && (
              <button
                type="button"
                onClick={() => {
                  const parentId = currentFolder?.parentFolderId;
                  if (parentId) navigate(`/library/${parentId}`);
                  else navigate('/library');
                }}
                className={`px-3 py-2 min-h-[44px] sm:min-h-[36px] border text-xs flex items-center space-x-1 cursor-pointer transition-colors ${
                  isDark
                    ? 'border-[#334155] text-[#cbd5e1] hover:bg-[#1e293b]'
                    : 'border-[#cccccc] text-[#111111] hover:bg-[#f5f5f5]'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Up Level</span>
              </button>
            )}

            {permissions.manage && (
              <button
                type="button"
                onClick={() => setShowCreateFolderModal(true)}
                className={`px-3 py-2 min-h-[44px] sm:min-h-[36px] border text-xs flex items-center space-x-1.5 font-medium cursor-pointer transition-colors ${
                  isDark
                    ? 'border-[#334155] text-[#f8fafc] bg-[#1e293b] hover:bg-[#334155]'
                    : 'border-[#111111] text-[#111111] bg-[#ffffff] hover:bg-[#f5f5f5]'
                }`}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New Folder</span>
              </button>
            )}

            {folderId && folderId !== 'root' && permissions.upload && (
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className={`px-3.5 sm:px-4 py-2 min-h-[44px] sm:min-h-[36px] text-xs flex items-center space-x-1.5 font-semibold uppercase tracking-wider cursor-pointer transition-colors ${
                  isDark
                    ? 'bg-[#f8fafc] text-[#0b0f17] hover:bg-[#e2e8f0]'
                    : 'bg-[#111111] text-[#ffffff] hover:bg-[#333333]'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div
          className={`p-4 border text-xs flex items-center space-x-2 ${
            isDark
              ? 'bg-[#451a1a] border-[#b91c1c] text-[#fca5a5]'
              : 'bg-[#fafafa] border-[#111111] text-[#111111]'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div
          className={`p-8 sm:p-12 text-center text-xs font-mono border transition-colors ${
            isDark
              ? 'bg-[#141c2b] border-[#243042] text-[#94a3b8]'
              : 'bg-[#ffffff] border-[#e5e5e5] text-[#777777]'
          }`}
        >
          Retrieving repository directory structure and DOConCD catalogue records...
        </div>
      ) : (
        <>
          {/* Collapsible Subfolders & Categories Section */}
          {subfolders.length > 0 && (
            <div
              className={`border transition-colors ${
                isDark ? 'bg-[#141c2b] border-[#243042]' : 'bg-[#ffffff] border-[#e5e5e5]'
              }`}
            >
              {/* Collapsible Accordion Header */}
              <button
                type="button"
                id="subfolders-accordion-header"
                aria-expanded={isFoldersExpanded}
                aria-controls="subfolders-accordion-content"
                onClick={() => setIsFoldersExpanded((prev) => !prev)}
                className={`w-full px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between text-xs cursor-pointer transition-colors text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 select-none group ${
                  isDark
                    ? 'bg-[#111827] text-[#f8fafc] hover:bg-[#162032]'
                    : 'bg-[#fafafa] text-[#111111] hover:bg-[#f0f0f0]'
                } ${
                  isFoldersExpanded
                    ? 'border-b ' + (isDark ? 'border-[#243042]' : 'border-[#e5e5e5]')
                    : ''
                }`}
              >
                <div className="flex items-center space-x-2 truncate min-w-0 mr-2">
                  <Folder
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isFoldersExpanded
                        ? isDark
                          ? 'text-[#60a5fa]'
                          : 'text-sky-600'
                        : isDark
                        ? 'text-[#94a3b8]'
                        : 'text-[#64748b]'
                    }`}
                  />
                  <span className="font-semibold uppercase tracking-wider text-xs sm:text-xs truncate">
                    Subfolders & Categories ({subfolders.length})
                  </span>
                  <span
                    className={`text-[11px] hidden md:inline transition-opacity duration-150 ${
                      isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                    }`}
                  >
                    • {isFoldersExpanded ? 'Click to collapse folders' : 'Click to show folders'}
                  </span>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider hidden sm:inline ${
                      isDark ? 'text-[#64748b]' : 'text-[#94a3b8]'
                    }`}
                  >
                    {isFoldersExpanded ? 'Hide' : 'Show'}
                  </span>
                  <div
                    className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                      isDark
                        ? 'group-hover:bg-[#1e293b] text-[#cbd5e1]'
                        : 'group-hover:bg-[#e2e8f0] text-[#475569]'
                    }`}
                  >
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform duration-300 ease-in-out ${
                        isFoldersExpanded ? 'rotate-180 text-sky-400' : ''
                      }`}
                    />
                  </div>
                </div>
              </button>

              {/* Collapsible Content Area */}
              <div
                id="subfolders-accordion-content"
                role="region"
                aria-labelledby="subfolders-accordion-header"
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  isFoldersExpanded
                    ? 'max-h-[3000px] opacity-100 p-3 sm:p-4'
                    : 'max-h-0 opacity-0 p-0 pointer-events-none'
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                  {subfolders.map((sf) => (
                    <div
                      key={sf._id}
                      onClick={() => navigate(`/library/${sf._id}`)}
                      role="button"
                      tabIndex={isFoldersExpanded ? 0 : -1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/library/${sf._id}`);
                        }
                      }}
                      className={`border p-3 cursor-pointer transition-colors flex items-center justify-between group focus:outline-hidden focus-visible:ring-1 focus-visible:ring-sky-500 ${
                        isDark
                          ? 'bg-[#0f172a] border-[#243042] hover:border-[#60a5fa] hover:bg-[#162032]'
                          : 'bg-[#ffffff] border-[#e5e5e5] hover:border-[#111111] hover:bg-[#fafafa]'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate mr-2 min-w-0">
                        <Folder
                          className={`w-4 h-4 shrink-0 ${
                            isDark ? 'text-[#60a5fa]' : 'text-[#111111]'
                          }`}
                        />
                        <div className="truncate min-w-0">
                          <div
                            className={`font-medium text-xs truncate group-hover:underline ${
                              isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                            }`}
                          >
                            {sf.name}
                          </div>
                          <div
                            className={`text-[10px] ${
                              isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                            }`}
                          >
                            {(sf.totalDocumentsCount ?? sf.documentsCount) || 0} docs • {(sf.totalSubfoldersCount ?? sf.subfoldersCount) || 0} subfolders
                          </div>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                          isDark
                            ? 'text-[#64748b] group-hover:text-[#f8fafc]'
                            : 'text-[#cccccc] group-hover:text-[#111111]'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DOConCD-STYLE DOCUMENT BROWSER TABLE */}
          {folderId && folderId !== 'root' ? (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs px-1 gap-1">
                <div
                  className={`font-bold uppercase tracking-wider flex items-center space-x-1.5 ${
                    isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    {currentFolder?.name?.includes('SIMODRIVE') || breadcrumbs.some((b) => b.name?.includes('SIMODRIVE'))
                      ? 'Siemens SINUMERIK / SIMODRIVE Technical Document Catalogue'
                      : 'DOConCD Technical Document Catalogue'}
                  </span>
                </div>
                <div
                  className={`text-[11px] font-mono ${
                    isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                  }`}
                >
                  {currentFolder?.name?.includes('SIMODRIVE') || breadcrumbs.some((b) => b.name?.includes('SIMODRIVE'))
                    ? 'DOConCD SINUMERIK / SIMODRIVE 09/2011 Table of Contents Reference'
                    : 'Siemens SINUMERIK / SINAMICS Table-of-Contents Specification'}
                </div>
              </div>

              <DOConCDTable
                documents={documents}
                groupedByCategory={groupedByCategory}
                availableCategories={availableCategories}
                availableSystems={availableSystems}
                userPermissions={permissions}
                onSelectDocument={(doc) => openDocument && openDocument(doc)}
                onDownloadDocument={handleDownload}
                isSimodrive={Boolean(
                  currentFolder?.name?.includes('SIMODRIVE') ||
                  breadcrumbs.some((b) => b.name?.includes('SIMODRIVE')) ||
                  currentFolder?.code === 'SIMODRIVE'
                )}
              />
            </div>
          ) : (
            /* Root View: Prompt to select a repository */
            <div
              className={`border p-8 text-center text-xs transition-colors ${
                isDark
                  ? 'bg-[#141c2b] border-[#243042] text-[#94a3b8]'
                  : 'bg-[#ffffff] border-[#e5e5e5] text-[#777777]'
              }`}
            >
              <FolderTree
                className={`w-10 h-10 mx-auto mb-3 ${
                  isDark ? 'text-[#60a5fa]' : 'text-[#111111]'
                }`}
              />
              <h3
                className={`font-bold text-sm mb-1 ${
                  isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                }`}
              >
                Select a Root Document Repository Above
              </h3>
              <p
                className={`max-w-md mx-auto leading-relaxed ${
                  isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                }`}
              >
                Click any repository folder above such as{' '}
                <strong className={isDark ? 'text-[#f8fafc]' : 'text-[#111111]'}>
                  DOConCD_SINUMERIK_SIMODRIVE
                </strong>{' '}
                or{' '}
                <strong className={isDark ? 'text-[#f8fafc]' : 'text-[#111111]'}>
                  DOConCD SINUMERIK - SINAMICS 09/2011 English
                </strong>{' '}
                to open the official DOConCD catalogue table.
              </p>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showUploadModal && (
        <UploadModal
          folderId={folderId}
          folderName={currentFolder?.name}
          defaultSystem={currentFolder?.code || ''}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => fetchLibraryData()}
        />
      )}

      {showCreateFolderModal && (
        <CreateFolderModal
          parentFolderId={folderId && folderId !== 'root' ? folderId : null}
          parentName={currentFolder?.name || 'Root Library'}
          onClose={() => setShowCreateFolderModal(false)}
          onCreated={() => fetchLibraryData()}
        />
      )}
    </div>
  );
}
