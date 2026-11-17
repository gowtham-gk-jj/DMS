import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
  FileText,
  Lock,
  Info,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';

const PdfViewer = lazy(() => import('./viewer/PdfViewer'));
const DocxViewer = lazy(() => import('./viewer/DocxViewer'));
const SpreadsheetViewer = lazy(() => import('./viewer/SpreadsheetViewer'));
const ImageViewer = lazy(() => import('./viewer/ImageViewer'));

export default function DocumentViewer({ document: doc, userPermissions = {}, onClose }) {
  const { isDark } = useTheme();
  const modalRef = useRef(null);

  // Viewer display state
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'metadata'

  // PDF Page tracking
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [targetPage, setTargetPage] = useState(null);

  // In-memory document buffer and blob URL
  const [documentBuffer, setDocumentBuffer] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [copiedText, setCopiedText] = useState(false);

  const ext = (doc?.fileExtension || '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  const isDocx = ['docx', 'doc'].includes(ext);
  const isExcel = ['xlsx', 'xls', 'csv'].includes(ext);
  const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
  const isAudio = ['mp3', 'wav', 'aac'].includes(ext);
  const isText = ['txt', 'json', 'log', 'md', 'xml'].includes(ext);

  const token = typeof window !== 'undefined' ? localStorage.getItem('dms_token') : null;
  const rawApiUrl = api.defaults.baseURL || '/api';
  const pdfStreamUrl = doc?._id
    ? `${rawApiUrl}/documents/${doc._id}/stream?token=${encodeURIComponent(token || '')}`
    : null;

  const [loadingStream, setLoadingStream] = useState(!isPdf);
  const [streamError, setStreamError] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Track Fullscreen state changes (e.g. if user presses Esc in browser fullscreen)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Fetch document stream using authenticated Axios instance
  const fetchDocument = useCallback(() => {
    if (!doc?._id) return;

    const controller = new AbortController();
    setLoadingStream(true);
    setStreamError('');

    api
      .get(`/documents/${doc._id}/stream`, {
        responseType: 'arraybuffer',
        signal: controller.signal,
      })
      .then((res) => {
        const buffer = res.data;
        setDocumentBuffer(buffer);

        // Create Blob and Object URL for media tags and text reading
        const mimeType = res.headers['content-type'] || doc?.mimeType || 'application/octet-stream';
        const blob = new Blob([buffer], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        setBlobUrl(url);

        if (isText) {
          try {
            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(buffer);
            setTextContent(text);
          } catch {
            const reader = new FileReader();
            reader.onload = () => setTextContent(reader.result);
            reader.readAsText(blob);
          }
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error('Failed to stream document:', err);
        const msg =
          err.response?.status === 404
            ? 'The requested document file could not be found in storage repository.'
            : err.response?.status === 403
            ? 'You do not have permission to view this document.'
            : 'Unable to stream document. Verify your network connection and permissions.';
        setStreamError(msg);
      })
      .finally(() => {
        setLoadingStream(false);
      });

    return () => {
      controller.abort();
    };
  }, [doc?._id, doc?.mimeType, isText]);

  useEffect(() => {
    // For PDFs, we stream directly via HTTP Range requests in PdfViewer.
    // Upfront arraybuffer fetch is reserved for non-PDF files or fallback.
    if (isPdf) {
      setLoadingStream(false);
      return;
    }
    const cancel = fetchDocument();
    return () => {
      if (cancel) cancel();
      if (blobUrl) {
        window.URL.revokeObjectURL(blobUrl);
      }
    };
  }, [fetchDocument, isPdf, blobUrl]);

  const canDownload = userPermissions.download !== false;

  const handleDownload = async () => {
    if (!canDownload) return;
    try {
      setDownloading(true);
      const res = await api.get(`/documents/${doc._id}/download?stream=true`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: doc.mimeType || 'application/octet-stream',
      });
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = doc.originalFileName || `${doc.title || 'document'}.${ext || 'pdf'}`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert(err.response?.data?.message || 'Download failed or permission denied.');
    } finally {
      setDownloading(false);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleResetZoom = () => setZoom(100);
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalRef.current?.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  };

  const copyTextToClipboard = () => {
    navigator.clipboard.writeText(textContent).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex flex-col w-screen h-screen overflow-hidden select-none"
    >
      {/* Top Header Bar */}
      <header className="border-b border-[var(--border-color)] px-3 sm:px-5 py-2.5 shrink-0 flex flex-col gap-2 bg-[var(--bg-header)] text-[var(--text-primary)]">
        {/* Row 1: File Title & Meta + Action Buttons */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center space-x-3 truncate min-w-0 flex-1">
            <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]">
              <FileText className="w-4 h-4" />
            </div>
            <div className="truncate min-w-0">
              <div className="font-semibold text-xs sm:text-sm truncate flex items-center space-x-2 text-[var(--text-primary)]">
                <span className="truncate max-w-[180px] sm:max-w-md md:max-w-xl" title={doc.title}>
                  {doc.title}
                </span>
                {doc.documentCode && (
                  <span className="border border-[var(--border-color)] px-1.5 py-0.2 rounded-xs font-mono text-[9px] sm:text-[10px] hidden sm:inline-block bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                    {doc.documentCode}
                  </span>
                )}
              </div>
              <div className="text-[10px] sm:text-[11px] font-mono truncate flex items-center space-x-1.5 text-[var(--text-muted)] mt-0.5">
                <span className="truncate max-w-[140px] sm:max-w-xs">{doc.originalFileName}</span>
                <span>•</span>
                <span>{formatFileSize(doc.fileSize)}</span>
                {doc.system && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline text-[var(--text-secondary)]">{doc.system}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Header Actions: Info, Download, Fullscreen, Close */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Info / Metadata Tab Toggle */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'preview' ? 'metadata' : 'preview')}
              title={activeTab === 'preview' ? 'View Document Metadata' : 'Back to Preview'}
              aria-label="Toggle Document Metadata"
              className={`p-2 sm:px-2.5 sm:py-1 min-h-[44px] min-w-[44px] sm:min-h-[34px] sm:min-w-[34px] text-xs rounded-md border transition-colors cursor-pointer flex items-center justify-center space-x-1 ${
                activeTab === 'metadata'
                  ? 'bg-[var(--primary-blue)] text-white border-[var(--primary-blue)]'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Info className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline font-medium">Info</span>
            </button>

            {/* Download Button */}
            {canDownload ? (
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                title="Download original document"
                aria-label="Download original document"
                className="dms-btn-primary p-2 sm:px-3 sm:py-1 min-h-[44px] min-w-[44px] sm:min-h-[34px] text-xs font-medium"
              >
                <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">{downloading ? 'Saving...' : 'Download'}</span>
              </button>
            ) : (
              <div
                title="Download restricted by administrator"
                className="flex items-center space-x-1 text-[10px] font-mono border border-[var(--border-color)] px-2 py-1 rounded-md bg-[var(--bg-elevated)] text-[var(--text-muted)] select-none"
              >
                <Lock className="w-3 h-3" />
                <span className="hidden sm:inline">Read-Only</span>
              </div>
            )}

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="p-2 sm:p-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer min-w-[44px] min-h-[44px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              title="Close Viewer (Esc)"
              aria-label="Close Viewer"
              className="p-2 sm:p-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors ml-1 cursor-pointer min-w-[44px] min-h-[44px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Toolbar for Zoom and Page Navigation */}
        {activeTab === 'preview' && (isPdf || isImage) && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 border-[var(--border-subtle)] text-xs">
            {/* Zoom Controls */}
            <div className="flex items-center space-x-1 border border-[var(--border-color)] rounded-md px-1.5 py-0.5 bg-[var(--bg-card)]">
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom Out"
                aria-label="Zoom Out"
                className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset Zoom / Fit Width"
                className="text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1 min-h-[32px] flex items-center justify-center cursor-pointer"
              >
                {zoom}%
              </button>

              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom In"
                aria-label="Zoom In"
                className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              {/* Rotate button for Images & PDFs */}
              <button
                type="button"
                onClick={handleRotate}
                title="Rotate 90 degrees"
                aria-label="Rotate 90 degrees"
                className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] ml-1 border-l border-[var(--border-color)] cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* PDF Page Navigation */}
            {isPdf && totalPages > 1 && (
              <div className="flex items-center space-x-1 border border-[var(--border-color)] rounded-md px-2 py-0.5 text-xs font-mono bg-[var(--bg-card)] text-[var(--text-secondary)]">
                <button
                  type="button"
                  onClick={() => {
                    const prev = Math.max(currentPage - 1, 1);
                    setCurrentPage(prev);
                    setTargetPage({ page: prev, id: Date.now() });
                  }}
                  disabled={currentPage <= 1}
                  title="Previous Page"
                  aria-label="Previous Page"
                  className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[var(--text-primary)] px-1.5 font-semibold">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.min(currentPage + 1, totalPages);
                    setCurrentPage(next);
                    setTargetPage({ page: next, id: Date.now() });
                  }}
                  disabled={currentPage >= totalPages}
                  title="Next Page"
                  aria-label="Next Page"
                  className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col bg-[var(--bg-main)]">
        {activeTab === 'metadata' ? (
          /* Catalogue Document Metadata Inspector */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-start justify-center">
            <div className="dms-card max-w-2xl w-full p-5 sm:p-7">
              <h3 className="font-bold text-sm uppercase tracking-wide border-b border-[var(--border-color)] pb-3 mb-4 font-mono text-[var(--text-primary)]">
                Catalogue Document Metadata
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block text-[11px] text-[var(--text-muted)] font-mono">
                    System Platform:
                  </span>
                  <span className="font-semibold text-sm text-[var(--text-primary)]">{doc.system || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[var(--text-muted)] font-mono">
                    Document Code:
                  </span>
                  <span className="font-mono font-semibold text-[var(--primary-blue)]">{doc.documentCode || doc.fileName || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[var(--text-muted)] font-mono">
                    Title:
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">{doc.title}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[var(--text-muted)] font-mono">
                    Category:
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">{doc.category || 'General'}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[var(--text-muted)] font-mono">
                    Software Version:
                  </span>
                  <span className="font-mono text-[var(--text-secondary)]">{doc.softwareVersion || '—'}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[var(--text-muted)] font-mono">
                    Edition:
                  </span>
                  <span className="font-mono text-[var(--text-secondary)]">{doc.edition || '—'}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[var(--text-muted)] font-mono">
                    Siemens Order No:
                  </span>
                  <span className="font-mono text-[var(--text-secondary)]">{doc.orderNumber || '—'}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[var(--text-muted)] font-mono">
                    File Format / Size:
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {doc.fileExtension?.toUpperCase()} ({formatFileSize(doc.fileSize)})
                  </span>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <span className="block text-[11px] text-[var(--text-muted)] font-mono">
                    Original File Name:
                  </span>
                  <span className="font-mono text-xs text-[var(--text-primary)]">{doc.originalFileName}</span>
                </div>
                {doc.description && (
                  <div className="col-span-1 sm:col-span-2">
                    <span className="block text-[11px] text-[var(--text-muted)] font-mono">
                      Description:
                    </span>
                    <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">{doc.description}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--border-color)] flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="dms-btn-primary px-4 py-2 text-xs"
                >
                  Back to Preview
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Live Document Previewer View */
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            {loadingStream ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-[var(--text-secondary)]">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-[var(--primary-blue)]" />
                <span className="font-medium text-sm text-[var(--text-primary)]">Streaming technical document...</span>
                <span className="text-[11px] font-mono text-[var(--text-muted)] mt-1">{doc.originalFileName}</span>
              </div>
            ) : streamError ? (
              <div className="dms-card max-w-md w-full p-6 text-center m-4">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-[var(--color-warning)]" />
                <h4 className="font-semibold text-sm mb-2 text-[var(--text-primary)]">Unable to Preview Document</h4>
                <p className="text-xs mb-4 leading-relaxed text-[var(--text-secondary)]">
                  {streamError}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={fetchDocument}
                    className="dms-btn-secondary w-full sm:w-auto px-4 py-2 text-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Preview</span>
                  </button>

                  {canDownload && (
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="dms-btn-primary w-full sm:w-auto px-4 py-2 text-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (documentBuffer || (isPdf && pdfStreamUrl)) ? (
              /* Actual File Previewers */
              <Suspense
                fallback={
                  <div className="flex flex-col items-center justify-center p-8 text-xs text-[var(--text-secondary)]">
                    <Loader2 className="w-8 h-8 animate-spin mb-3 text-[var(--primary-blue)]" />
                    <span className="font-medium text-[var(--text-primary)]">Loading preview engine...</span>
                  </div>
                }
              >
                {/* 1. PDF Documents */}
                {isPdf && (
                  <PdfViewer
                    url={pdfStreamUrl}
                    token={token}
                    data={documentBuffer}
                    zoom={zoom}
                    rotation={rotation}
                    targetPage={targetPage}
                    currentPage={currentPage}
                    onTotalPages={setTotalPages}
                    onCurrentPageChange={setCurrentPage}
                    onErrorFallback={() => {
                      fetchDocument();
                    }}
                    isDark={isDark}
                  />
                )}

                {/* 2. Images */}
                {isImage && (
                  <ImageViewer
                    src={blobUrl || doc.secureUrl}
                    alt={doc.title}
                    zoom={zoom}
                    rotation={rotation}
                    isDark={isDark}
                  />
                )}

                {/* 3. Word Documents */}
                {isDocx && (
                  <DocxViewer
                    data={documentBuffer}
                    isDark={isDark}
                    canDownload={canDownload}
                    onDownload={handleDownload}
                    fileName={doc.originalFileName}
                  />
                )}

                {/* 4. Spreadsheets */}
                {isExcel && (
                  <SpreadsheetViewer
                    data={documentBuffer}
                    isDark={isDark}
                    canDownload={canDownload}
                    onDownload={handleDownload}
                    fileName={doc.originalFileName}
                  />
                )}

                {/* 5. Plain Text, CSV, JSON, Log files */}
                {isText && (
                  <div className="w-full h-full flex flex-col p-3 sm:p-5">
                    <div className="flex justify-end mb-2">
                      <button
                        type="button"
                        onClick={copyTextToClipboard}
                        className={`dms-btn-secondary px-3 py-1.5 text-xs ${
                          copiedText ? 'text-[var(--color-success)]' : ''
                        }`}
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedText ? 'Copied' : 'Copy Content'}</span>
                      </button>
                    </div>
                    <pre className="flex-1 overflow-auto p-4 rounded-md border border-[var(--border-color)] font-mono text-xs whitespace-pre-wrap select-text bg-[var(--bg-card)] text-[var(--text-primary)]">
                      {textContent}
                    </pre>
                  </div>
                )}

                {/* 6. Video Player */}
                {isVideo && (
                  <div className="max-w-4xl w-full p-3 sm:p-5 flex items-center justify-center">
                    <video
                      controls
                      autoPlay={false}
                      className="w-full max-h-[80vh] rounded-lg shadow-2xl bg-black"
                    >
                      <source src={blobUrl || doc.secureUrl} type={doc.mimeType} />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}

                {/* 7. Audio Player */}
                {isAudio && (
                  <div className="max-w-md w-full p-6 text-center dms-card m-4">
                    <audio controls className="w-full mt-2">
                      <source src={blobUrl || doc.secureUrl} type={doc.mimeType} />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </Suspense>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
