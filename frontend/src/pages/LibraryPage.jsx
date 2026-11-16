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
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Top Header & Breadcrumb Path */}
      <div className="dms-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {/* Breadcrumb Trail */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs mb-1.5 font-mono text-[var(--text-muted)]">
              <button
                onClick={() => navigate('/library')}
                className="hover:underline cursor-pointer hover:text-[var(--text-primary)] transition-colors"
              >
                DOCUMENT LIBRARY
              </button>
              {breadcrumbs.map((b) => (
                <React.Fragment key={b.id || b.name}>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[var(--border-strong)]" />
                  <button
                    onClick={() => navigate(`/library/${b.id}`)}
                    className="hover:underline cursor-pointer truncate max-w-[150px] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {b.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {currentFolder ? currentFolder.name : 'Engineering Document Library'}
            </h1>
            <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
              {currentFolder?.description ||
                'Browse root document catalogues, nested subcategories, and DOConCD technical manuals.'}
            </p>
          </div>

          {/* Action Buttons: Upload & New Subfolder */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {folderId && folderId !== 'root' && (
              <button
                type="button"
                onClick={() => {
                  const parentId = currentFolder?.parentFolderId;
                  if (parentId) navigate(`/library/${parentId}`);
                  else navigate('/library');
                }}
                className="dms-btn-secondary px-3 py-2 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Up Level</span>
              </button>
            )}

            {permissions.manage && (
              <button
                type="button"
                onClick={() => setShowCreateFolderModal(true)}
                className="dms-btn-secondary px-3.5 py-2 text-xs font-medium"
              >
                <FolderPlus className="w-3.5 h-3.5 text-[var(--primary-blue)]" />
                <span>New Folder</span>
              </button>
            )}

            {folderId && folderId !== 'root' && permissions.upload && (
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="dms-btn-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)] text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-[var(--text-muted)] dms-card">
          Retrieving repository directory structure and DOConCD catalogue records...
        </div>
      ) : (
        <>
          {/* Collapsible Subfolders & Categories Section */}
          {subfolders.length > 0 && (
            <div className="dms-card overflow-hidden">
              {/* Collapsible Accordion Header */}
              <button
                type="button"
                id="subfolders-accordion-header"
                aria-expanded={isFoldersExpanded}
                aria-controls="subfolders-accordion-content"
                onClick={() => setIsFoldersExpanded((prev) => !prev)}
                className="w-full px-4 sm:px-5 py-3 flex items-center justify-between text-xs cursor-pointer transition-colors text-left bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] select-none group border-b border-[var(--border-subtle)]"
              >
                <div className="flex items-center space-x-2.5 truncate min-w-0 mr-2">
                  <Folder className="w-4 h-4 shrink-0 text-[var(--primary-blue)]" />
                  <span className="font-semibold uppercase tracking-wider text-xs truncate text-[var(--text-primary)] font-mono">
                    Subfolders & Categories ({subfolders.length})
                  </span>
                  <span className="text-[11px] hidden md:inline text-[var(--text-muted)]">
                    • {isFoldersExpanded ? 'Click to collapse' : 'Click to expand'}
                  </span>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline text-[var(--text-muted)]">
                    {isFoldersExpanded ? 'Hide' : 'Show'}
                  </span>
                  <div className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-secondary)]">
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform duration-250 ease-in-out ${
                        isFoldersExpanded ? 'rotate-180 text-[var(--primary-blue)]' : ''
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
                    ? 'max-h-[3000px] opacity-100 p-4 sm:p-5'
                    : 'max-h-0 opacity-0 p-0 pointer-events-none'
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
                      className="dms-card-interactive p-3.5 cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-2.5 truncate mr-2 min-w-0">
                        <Folder className="w-4 h-4 shrink-0 text-[var(--primary-blue)]" />
                        <div className="truncate min-w-0">
                          <div className="font-semibold text-xs truncate text-[var(--text-primary)] group-hover:text-[var(--primary-blue)] transition-colors">
                            {sf.name}
                          </div>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                            {(sf.totalDocumentsCount ?? sf.documentsCount) || 0} docs • {(sf.totalSubfoldersCount ?? sf.subfoldersCount) || 0} folders
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--primary-blue)] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DOConCD-STYLE DOCUMENT BROWSER TABLE */}
          {folderId && folderId !== 'root' ? (
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs px-1 gap-1">
                <div className="font-bold uppercase tracking-wider flex items-center space-x-2 text-[var(--text-primary)] font-mono">
                  <FileText className="w-4 h-4 text-[var(--primary-blue)]" />
                  <span>
                    {currentFolder?.name?.includes('SIMODRIVE') || breadcrumbs.some((b) => b.name?.includes('SIMODRIVE'))
                      ? 'Siemens SINUMERIK / SIMODRIVE Technical Document Catalogue'
                      : 'DOConCD Technical Document Catalogue'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[var(--text-muted)]">
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
            <div className="dms-card p-10 text-center text-xs">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]">
                <FolderTree className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1">
                Select a Root Document Repository Above
              </h3>
              <p className="max-w-md mx-auto leading-relaxed text-[var(--text-secondary)] text-xs">
                Click any repository folder above such as{' '}
                <strong className="text-[var(--text-primary)] font-semibold">
                  DOConCD_SINUMERIK_SIMODRIVE
                </strong>{' '}
                or{' '}
                <strong className="text-[var(--text-primary)] font-semibold">
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
