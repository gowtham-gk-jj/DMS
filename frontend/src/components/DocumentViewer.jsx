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
  const [loadingStream, setLoadingStream] = useState(true);
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

  const ext = (doc?.fileExtension || '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  const isDocx = ['docx', 'doc'].includes(ext);
  const isExcel = ['xlsx', 'xls', 'csv'].includes(ext);
  const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
  const isAudio = ['mp3', 'wav', 'aac'].includes(ext);
  const isText = ['txt', 'json', 'log', 'md', 'xml'].includes(ext);

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
    const cancel = fetchDocument();
    return () => {
      if (cancel) cancel();
      if (blobUrl) {
        window.URL.revokeObjectURL(blobUrl);
      }
    };
  }, [fetchDocument]);

  const canDownload = userPermissions.download;

  const handleDownload = async () => {
    if (!canDownload) {
      alert('You do not have permission to download this technical document.');
      return;
    }
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
      console.error('Download failed:', err);
      alert(err.response?.data?.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 20, 260));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 20, 40));
  const handleResetZoom = () => {
    setZoom(100);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const toggleFullscreen = () => {
    if (!modalRef.current) return;
    if (!document.fullscreenElement) {
      modalRef.current.requestFullscreen?.().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen?.().catch((err) => {
        console.warn('Exit fullscreen failed:', err);
      });
    }
  };

  const copyTextToClipboard = () => {
    if (!textContent) return;
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
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex flex-col w-screen h-screen overflow-hidden select-none"
    >
      {/* Top Header Bar */}
      <header
        className={`border-b px-2.5 sm:px-4 py-2 shrink-0 flex flex-col gap-1.5 ${
          isDark
            ? 'bg-[#0f172a] border-[#243042] text-[#f8fafc]'
            : 'bg-[#111111] border-[#333333] text-[#ffffff]'
        }`}
      >
        {/* Row 1: File Title & Meta + Action Buttons (Close, Fullscreen) */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center space-x-2 truncate min-w-0 flex-1">
            <FileText
              className={`w-4 h-4 shrink-0 ${isDark ? 'text-[#60a5fa]' : 'text-[#60a5fa]'}`}
            />
            <div className="truncate min-w-0">
              <div className="font-semibold text-xs sm:text-sm truncate flex items-center space-x-2">
                <span className="truncate max-w-[180px] sm:max-w-md md:max-w-xl" title={doc.title}>
                  {doc.title}
                </span>
                {doc.documentCode && (
                  <span
                    className={`border px-1.5 py-0.2 font-mono text-[9px] sm:text-[10px] hidden sm:inline-block ${
                      isDark
                        ? 'bg-[#1e293b] border-[#334155] text-[#f8fafc]'
                        : 'bg-[#222222] border-[#444444] text-[#ffffff]'
                    }`}
                  >
                    {doc.documentCode}
                  </span>
                )}
              </div>
              <div
                className={`text-[10px] sm:text-[11px] truncate flex items-center space-x-1.5 ${
                  isDark ? 'text-[#94a3b8]' : 'text-[#aaaaaa]'
                }`}
              >
                <span className="truncate max-w-[140px] sm:max-w-xs">{doc.originalFileName}</span>
                <span>•</span>
                <span>{formatFileSize(doc.fileSize)}</span>
                {doc.system && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline font-mono">{doc.system}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Header Actions: Info, Download, Fullscreen, Close */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
            {/* Info / Metadata Tab Toggle */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'preview' ? 'metadata' : 'preview')}
              title={activeTab === 'preview' ? 'View Document Metadata' : 'Back to Preview'}
              aria-label="Toggle Document Metadata"
              className={`p-1.5 sm:px-2.5 sm:py-1 text-xs border transition-colors cursor-pointer flex items-center space-x-1 ${
                activeTab === 'metadata'
                  ? 'bg-[#0284c7] text-[#ffffff] border-[#0284c7]'
                  : isDark
                  ? 'bg-[#1e293b] text-[#cbd5e1] border-[#334155] hover:text-[#ffffff]'
                  : 'bg-[#222222] text-[#cccccc] border-[#333333] hover:text-[#ffffff]'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Info</span>
            </button>

            {/* Download Button */}
            {canDownload ? (
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                title="Download original document"
                aria-label="Download original document"
                className={`p-1.5 sm:px-3 sm:py-1 text-xs font-medium flex items-center space-x-1 transition-colors disabled:opacity-50 cursor-pointer ${
                  isDark
                    ? 'bg-[#f8fafc] text-[#0b0f17] hover:bg-[#e2e8f0]'
                    : 'bg-[#ffffff] text-[#111111] hover:bg-[#eeeeee]'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{downloading ? 'Saving...' : 'Download'}</span>
              </button>
            ) : (
              <div
                title="Download restricted by administrator"
                className={`flex items-center space-x-1 text-[10px] border px-2 py-1 select-none ${
                  isDark
                    ? 'bg-[#1e293b] text-[#94a3b8] border-[#334155]'
                    : 'bg-[#222222] text-[#888888] border-[#333333]'
                }`}
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
              className="p-1.5 text-[#cccccc] hover:text-[#ffffff] hover:bg-white/10 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button (Always visible & touch friendly) */}
            <button
              type="button"
              onClick={onClose}
              title="Close Viewer (Esc)"
              aria-label="Close Viewer"
              className="p-1.5 text-[#cccccc] hover:text-[#ffffff] hover:bg-white/10 transition-colors ml-1 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Toolbar for Zoom and Page Navigation */}
        {activeTab === 'preview' && (isPdf || isImage) && (
          <div className="flex items-center justify-between gap-2 border-t pt-1.5 border-white/10 text-xs">
            {/* Zoom Controls */}
            <div
              className={`flex items-center space-x-1 border px-1.5 py-0.5 ${
                isDark ? 'bg-[#1e293b] border-[#334155]' : 'bg-[#222222] border-[#333333]'
              }`}
            >
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom Out"
                aria-label="Zoom Out"
                className="p-1 text-[#cccccc] hover:text-[#ffffff] cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset Zoom / Fit Width"
                className="text-[11px] font-mono text-[#cccccc] hover:text-[#ffffff] px-1 cursor-pointer"
              >
                {zoom}%
              </button>

              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom In"
                aria-label="Zoom In"
                className="p-1 text-[#cccccc] hover:text-[#ffffff] cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              {/* Rotate button for Images & PDFs */}
              <button
                type="button"
                onClick={handleRotate}
                title="Rotate 90 degrees"
                aria-label="Rotate 90 degrees"
                className="p-1 text-[#cccccc] hover:text-[#ffffff] ml-1 border-l border-[#444444] cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* PDF Page Navigation */}
            {isPdf && totalPages > 1 && (
              <div
                className={`flex items-center space-x-1 border px-2 py-0.5 text-xs font-mono ${
                  isDark ? 'bg-[#1e293b] border-[#334155]' : 'bg-[#222222] border-[#333333]'
                }`}
              >
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
                  className="p-1 text-[#cccccc] hover:text-[#ffffff] disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[#cccccc]">
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
                  className="p-1 text-[#cccccc] hover:text-[#ffffff] disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main
        className={`flex-1 overflow-hidden relative flex flex-col ${
          isDark ? 'bg-[#090d16]' : 'bg-[#1a1a1a]'
        }`}
      >
        {activeTab === 'metadata' ? (
          /* Catalogue Document Metadata Inspector */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-start justify-center">
            <div
              className={`max-w-2xl w-full p-4 sm:p-6 border shadow-xl ${
                isDark
                  ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
                  : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
              }`}
            >
              <h3
                className={`font-bold text-sm uppercase tracking-wide border-b pb-2 mb-4 ${
                  isDark ? 'border-[#243042] text-[#f8fafc]' : 'border-[#e5e5e5] text-[#111111]'
                }`}
              >
                Catalogue Document Metadata
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs">
                <div>
                  <span className={`block text-[11px] ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                    System Platform:
                  </span>
                  <span className="font-semibold text-sm">{doc.system || 'N/A'}</span>
                </div>
                <div>
                  <span className={`block text-[11px] ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                    Document Code:
                  </span>
                  <span className="font-mono font-semibold">{doc.documentCode || doc.fileName || 'N/A'}</span>
                </div>
                <div>
                  <span className={`block text-[11px] ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                    Title:
                  </span>
                  <span className="font-medium">{doc.title}</span>
                </div>
                <div>
                  <span className={`block text-[11px] ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                    Category:
                  </span>
                  <span className="font-medium">{doc.category || 'General'}</span>
                </div>
                <div>
                  <span className={`block text-[11px] ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                    Software Version:
                  </span>
                  <span className="font-mono">{doc.softwareVersion || '—'}</span>
                </div>
                <div>
                  <span className={`block text-[11px] ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                    Edition:
                  </span>
                  <span className="font-mono">{doc.edition || '—'}</span>
                </div>
                <div>
                  <span className={`block text-[11px] ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                    Siemens Order No:
                  </span>
                  <span className="font-mono">{doc.orderNumber || '—'}</span>
                </div>
                <div>
                  <span className={`block text-[11px] ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                    File Format / Size:
                  </span>
                  <span>
                    {doc.fileExtension?.toUpperCase()} ({formatFileSize(doc.fileSize)})
                  </span>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <span className={`block text-[11px] ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                    Original File Name:
                  </span>
                  <span className="font-mono text-xs">{doc.originalFileName}</span>
                </div>
                {doc.description && (
                  <div className="col-span-1 sm:col-span-2">
                    <span className={`block text-[11px] ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                      Description:
                    </span>
                    <p className="mt-1 leading-relaxed">{doc.description}</p>
                  </div>
                )}
              </div>

              <div
                className={`mt-6 pt-4 border-t flex justify-end ${
                  isDark ? 'border-[#243042]' : 'border-[#e5e5e5]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-4 py-1.5 text-xs font-medium cursor-pointer ${
                    isDark
                      ? 'bg-[#f8fafc] text-[#0b0f17] hover:bg-[#e2e8f0]'
                      : 'bg-[#111111] text-[#ffffff] hover:bg-[#333333]'
                  }`}
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
              <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-[#888888]">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#0284c7]" />
                <span className="font-medium text-sm text-[#f8fafc]">Streaming technical document...</span>
                <span className="text-[11px] text-[#64748b] mt-1">{doc.originalFileName}</span>
              </div>
            ) : streamError ? (
              <div
                className={`max-w-md w-full p-6 text-center border shadow-xl m-4 ${
                  isDark
                    ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
                    : 'bg-[#ffffff] border-[#e2e8f0] text-[#111111]'
                }`}
              >
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-[#f59e0b]" />
                <h4 className="font-semibold text-sm mb-2">Unable to Preview Document</h4>
                <p className={`text-xs mb-4 leading-relaxed ${isDark ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
                  {streamError}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={fetchDocument}
                    className={`w-full sm:w-auto px-4 py-2 text-xs font-medium flex items-center justify-center space-x-1.5 cursor-pointer border ${
                      isDark
                        ? 'bg-[#1e293b] text-[#f8fafc] border-[#334155] hover:bg-[#334155]'
                        : 'bg-[#f1f5f9] text-[#111111] border-[#cbd5e1] hover:bg-[#e2e8f0]'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Preview</span>
                  </button>

                  {canDownload && (
                    <button
                      type="button"
                      onClick={handleDownload}
                      className={`w-full sm:w-auto px-4 py-2 text-xs font-medium flex items-center justify-center space-x-1.5 cursor-pointer ${
                        isDark
                          ? 'bg-[#f8fafc] text-[#0b0f17] hover:bg-[#e2e8f0]'
                          : 'bg-[#111111] text-[#ffffff] hover:bg-[#333333]'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </button>
                  )}
                </div>
              </div>
            ) : documentBuffer ? (
              /* Actual File Previewers */
              <Suspense
                fallback={
                  <div className="flex flex-col items-center justify-center p-8 text-xs text-[#888888]">
                    <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#0284c7]" />
                    <span className="font-medium text-[#f8fafc]">Loading preview engine...</span>
                  </div>
                }
              >
                {/* 1. PDF Documents: Rendered directly with PDF.js */}
                {isPdf && (
                  <PdfViewer
                    data={documentBuffer}
                    zoom={zoom}
                    rotation={rotation}
                    targetPage={targetPage}
                    currentPage={currentPage}
                    onTotalPages={setTotalPages}
                    onCurrentPageChange={setCurrentPage}
                    isDark={isDark}
                  />
                )}

                {/* 2. Images: Responsive sizing, zoom and rotation */}
                {isImage && (
                  <ImageViewer
                    src={blobUrl || doc.secureUrl}
                    alt={doc.title}
                    zoom={zoom}
                    rotation={rotation}
                    isDark={isDark}
                  />
                )}

                {/* 3. Word Documents: Rendered in-browser with docx-preview */}
                {isDocx && (
                  <DocxViewer
                    data={documentBuffer}
                    isDark={isDark}
                    canDownload={canDownload}
                    onDownload={handleDownload}
                    fileName={doc.originalFileName}
                  />
                )}

                {/* 4. Spreadsheets: Rendered in-browser with xlsx */}
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
                  <div className="w-full h-full flex flex-col p-2 sm:p-4">
                    <div className="flex justify-end mb-2">
                      <button
                        type="button"
                        onClick={copyTextToClipboard}
                        className={`px-3 py-1 text-xs border flex items-center space-x-1 cursor-pointer transition-colors ${
                          copiedText
                            ? 'bg-green-600 border-green-600 text-white'
                            : isDark
                            ? 'bg-[#1e293b] border-[#334155] text-[#cbd5e1] hover:text-white'
                            : 'bg-[#ffffff] border-[#cbd5e1] text-[#475569] hover:bg-[#f1f5f9]'
                        }`}
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedText ? 'Copied' : 'Copy Content'}</span>
                      </button>
                    </div>
                    <pre
                      className={`flex-1 overflow-auto p-4 border font-mono text-xs whitespace-pre-wrap select-text ${
                        isDark
                          ? 'bg-[#0f172a] text-[#f8fafc] border-[#334155]'
                          : 'bg-[#ffffff] text-[#111111] border-[#cbd5e1]'
                      }`}
                    >
                      {textContent}
                    </pre>
                  </div>
                )}

                {/* 6. Video Player */}
                {isVideo && (
                  <div className="max-w-4xl w-full p-2 sm:p-4 flex items-center justify-center">
                    <video
                      controls
                      autoPlay={false}
                      className="w-full max-h-[80vh] shadow-2xl bg-[#000000]"
                    >
                      <source src={blobUrl || doc.secureUrl} type={doc.mimeType} />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}

                {/* 7. Audio Player */}
                {isAudio && (
                  <div
                    className={`p-6 sm:p-8 border text-center max-w-md w-full shadow-2xl ${
                      isDark
                        ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
                        : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
                    }`}
                  >
                    <FileText
                      className={`w-12 h-12 mx-auto mb-3 ${
                        isDark ? 'text-[#60a5fa]' : 'text-[#111111]'
                      }`}
                    />
                    <h4 className="font-semibold text-sm mb-4">{doc.title}</h4>
                    <audio controls className="w-full">
                      <source src={blobUrl || doc.secureUrl} type={doc.mimeType} />
                    </audio>
                  </div>
                )}

                {/* 8. Other / Unsupported Binary Formats */}
                {!isPdf && !isImage && !isDocx && !isExcel && !isText && !isVideo && !isAudio && (
                  <div
                    className={`p-6 sm:p-8 max-w-lg w-full text-center border shadow-2xl m-4 ${
                      isDark
                        ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
                        : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
                    }`}
                  >
                    <FileText
                      className={`w-14 h-14 mx-auto mb-4 ${
                        isDark ? 'text-[#60a5fa]' : 'text-[#111111]'
                      }`}
                    />
                    <h3 className="font-bold text-base mb-1">{doc.title}</h3>
                    <p
                      className={`text-xs mb-4 ${
                        isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                      }`}
                    >
                      {doc.originalFileName} ({formatFileSize(doc.fileSize)})
                    </p>
                    <div
                      className={`border p-3 text-left text-xs mb-6 space-y-1 ${
                        isDark
                          ? 'bg-[#0f172a] border-[#243042] text-[#cbd5e1]'
                          : 'bg-[#fafafa] border-[#e5e5e5] text-[#111111]'
                      }`}
                    >
                      <div>
                        <strong>System:</strong> {doc.system || '—'}
                      </div>
                      <div>
                        <strong>Category:</strong> {doc.category || 'General'}
                      </div>
                      <div>
                        <strong>Order Number:</strong> {doc.orderNumber || '—'}
                      </div>
                    </div>

                    {canDownload ? (
                      <button
                        type="button"
                        onClick={handleDownload}
                        disabled={downloading}
                        className={`w-full py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-[#f8fafc] text-[#0b0f17] hover:bg-[#e2e8f0]'
                            : 'bg-[#111111] text-[#ffffff] hover:bg-[#333333]'
                        }`}
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Original Document</span>
                      </button>
                    ) : (
                      <div
                        className={`p-3 text-xs border ${
                          isDark
                            ? 'bg-[#1e293b] text-[#94a3b8] border-[#334155]'
                            : 'bg-[#f5f5f5] text-[#777777] border-[#cccccc]'
                        }`}
                      >
                        Document downloading is restricted for your role. Contact an administrator.
                      </div>
                    )}
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
