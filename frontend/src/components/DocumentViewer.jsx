import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function DocumentViewer({ document: doc, userPermissions = {}, onClose }) {
  const { isDark } = useTheme();
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'metadata'
  const [textContent, setTextContent] = useState('');

  // In-memory Blob URL for inline viewing (prevents auto-downloading)
  const [blobUrl, setBlobUrl] = useState(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamError, setStreamError] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const ext = (doc?.fileExtension || '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
  const isAudio = ['mp3', 'wav', 'aac'].includes(ext);
  const isText = ['txt', 'csv', 'json', 'log', 'md'].includes(ext);

  // Fetch document content via backend stream as a Blob
  useEffect(() => {
    if (!doc?._id) return;

    let active = true;
    let createdUrl = null;

    setLoadingStream(true);
    setStreamError('');
    setBlobUrl(null);

    api
      .get(`/documents/${doc._id}/stream`, { responseType: 'blob' })
      .then((res) => {
        if (!active) return;
        const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/pdf' });
        createdUrl = window.URL.createObjectURL(blob);
        setBlobUrl(createdUrl);

        if (isText) {
          const reader = new FileReader();
          reader.onload = () => setTextContent(reader.result);
          reader.readAsText(blob);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to stream document:', err);
        setStreamError('Unable to stream document. Verify network connection and permissions.');
      })
      .finally(() => {
        if (active) setLoadingStream(false);
      });

    return () => {
      active = false;
      if (createdUrl) {
        window.URL.revokeObjectURL(createdUrl);
      }
    };
  }, [doc?._id, isText]);

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
      a.download = doc.originalFileName || `${doc.title || 'document'}.pdf`;
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

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 250));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleResetZoom = () => {
    setZoom(100);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const formatFileSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col">
      {/* Top Header Bar: Responsive wrap on small screens */}
      <div
        className={`border-b px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 select-none shrink-0 ${
          isDark
            ? 'bg-[#0f172a] border-[#243042] text-[#f8fafc]'
            : 'bg-[#111111] border-[#333333] text-[#ffffff]'
        }`}
      >
        <div className="flex items-center space-x-2.5 truncate mr-2 min-w-0">
          <FileText
            className={`w-4 h-4 shrink-0 ${isDark ? 'text-[#60a5fa]' : 'text-[#cccccc]'}`}
          />
          <div className="truncate min-w-0">
            <div className="font-semibold text-xs truncate flex items-center space-x-2">
              <span className="truncate max-w-[140px] sm:max-w-xs md:max-w-md">
                {doc.title}
              </span>
              {doc.documentCode && (
                <span
                  className={`border px-1.5 py-0.2 font-mono text-[10px] hidden sm:inline-block ${
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
              className={`text-[10px] sm:text-[11px] truncate flex items-center space-x-1.5 mt-0.5 ${
                isDark ? 'text-[#94a3b8]' : 'text-[#888888]'
              }`}
            >
              <span className="truncate">{doc.originalFileName}</span>
              <span>•</span>
              <span>{formatFileSize(doc.fileSize)}</span>
              {doc.system && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{doc.system}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Zoom controls for PDF and Images */}
          {(isPdf || isImage) && (
            <div
              className={`flex items-center space-x-1 border px-1.5 py-0.5 ${
                isDark
                  ? 'bg-[#1e293b] border-[#334155]'
                  : 'bg-[#222222] border-[#333333]'
              }`}
            >
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom Out"
                aria-label="Zoom Out"
                className="p-1 text-[#cccccc] hover:text-[#ffffff] cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset Zoom"
                className="text-[11px] font-mono text-[#cccccc] hover:text-[#ffffff] px-1 cursor-pointer"
              >
                {zoom}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom In"
                aria-label="Zoom In"
                className="p-1 text-[#cccccc] hover:text-[#ffffff] cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {isImage && (
                <button
                  type="button"
                  onClick={handleRotate}
                  title="Rotate 90deg"
                  aria-label="Rotate 90 degrees"
                  className="p-1 text-[#cccccc] hover:text-[#ffffff] ml-1 border-l border-[#444444] cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Metadata Tab Toggle */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'preview' ? 'metadata' : 'preview')}
            className={`px-2.5 py-1 text-xs border transition-colors cursor-pointer ${
              activeTab === 'metadata'
                ? isDark
                  ? 'bg-[#f8fafc] text-[#0b0f17] border-[#f8fafc]'
                  : 'bg-[#ffffff] text-[#111111] border-[#ffffff]'
                : isDark
                ? 'bg-[#1e293b] text-[#cbd5e1] border-[#334155] hover:text-[#ffffff]'
                : 'bg-[#222222] text-[#cccccc] border-[#333333] hover:text-[#ffffff]'
            }`}
          >
            <span className="flex items-center space-x-1">
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Info</span>
            </span>
          </button>

          {/* Download Button (Enforces permissions) */}
          {canDownload ? (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className={`px-3 py-1 text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer ${
                isDark
                  ? 'bg-[#f8fafc] text-[#0b0f17] hover:bg-[#e2e8f0]'
                  : 'bg-[#ffffff] text-[#111111] hover:bg-[#eeeeee]'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'Saving...' : 'Download'}</span>
            </button>
          ) : (
            <div
              title="Download restricted by administrator"
              className={`flex items-center space-x-1 text-[11px] border px-2.5 py-1 select-none ${
                isDark
                  ? 'bg-[#1e293b] text-[#94a3b8] border-[#334155]'
                  : 'bg-[#222222] text-[#888888] border-[#333333]'
              }`}
            >
              <Lock className="w-3 h-3" />
              <span className="hidden sm:inline">Read-Only</span>
            </div>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1.5 text-[#cccccc] hover:text-[#ffffff] hover:bg-white/10 transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            title="Close Viewer (Esc)"
            aria-label="Close Viewer"
            className="p-1.5 text-[#cccccc] hover:text-[#ffffff] hover:bg-white/10 transition-colors ml-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className={`flex-1 overflow-auto flex items-center justify-center p-2 sm:p-4 ${
          isDark ? 'bg-[#090d16]' : 'bg-[#1e1e1e]'
        }`}
      >
        {activeTab === 'metadata' ? (
          /* Metadata Inspector View */
          <div
            className={`max-w-2xl w-full p-4 sm:p-6 border shadow-xl max-h-[85vh] overflow-y-auto ${
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
        ) : (
          /* Live Document Previewer */
          <div className="w-full h-full flex items-center justify-center">
            {/* 1. PDF Viewer with in-memory Blob rendering */}
            {isPdf && (
              <div
                className="w-full h-full bg-[#ffffff] shadow-2xl transition-transform duration-100 flex items-center justify-center"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
              >
                {loadingStream ? (
                  <div className="text-center text-xs p-8 text-[#777777]">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#111111]" />
                    <span>Loading PDF into viewer...</span>
                  </div>
                ) : blobUrl ? (
                  <iframe
                    src={`${blobUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                    title={doc.title}
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="text-center text-xs p-8 text-[#777777]">
                    <p className="font-semibold text-sm text-[#111111] mb-1">
                      {streamError || 'Unable to render PDF preview.'}
                    </p>
                    <p className="text-xs text-[#777777]">
                      {canDownload
                        ? 'You can download the document using the button in the top toolbar.'
                        : 'Contact your administrator for access.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 2. Image Viewer */}
            {isImage && (
              <div className="max-w-full max-h-full overflow-auto flex items-center justify-center p-2 sm:p-4">
                {loadingStream ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#ffffff]" />
                ) : (
                  <img
                    src={blobUrl || doc.secureUrl}
                    alt={doc.title}
                    className="max-w-full max-h-[82vh] object-contain shadow-2xl transition-all duration-150"
                    style={{
                      transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    }}
                  />
                )}
              </div>
            )}

            {/* 3. Text / CSV Viewer */}
            {isText && (
              <div
                className={`w-full max-w-4xl h-full border p-4 overflow-auto font-mono text-xs ${
                  isDark
                    ? 'bg-[#0f172a] text-[#f8fafc] border-[#334155]'
                    : 'bg-[#ffffff] text-[#111111] border-[#333333]'
                }`}
              >
                {loadingStream ? (
                  <p className={isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}>Loading file preview...</p>
                ) : (
                  <pre className="whitespace-pre-wrap">{textContent}</pre>
                )}
              </div>
            )}

            {/* 4. Video Player */}
            {isVideo && (
              <div className="max-w-4xl w-full">
                <video controls className="w-full max-h-[80vh] shadow-2xl bg-[#000000]">
                  <source src={blobUrl || doc.secureUrl} type={doc.mimeType} />
                  Your browser does not support the video tag.
                </video>
              </div>
            )}

            {/* 5. Audio Player */}
            {isAudio && (
              <div
                className={`p-6 sm:p-8 border text-center max-w-md w-full ${
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

            {/* 6. Office / Binary Document Preview Fallback */}
            {!isPdf && !isImage && !isVideo && !isAudio && !isText && (
              <div
                className={`p-6 sm:p-8 max-w-lg w-full text-center border shadow-2xl ${
                  isDark
                    ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
                    : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
                }`}
              >
                <FileText
                  className={`w-16 h-16 mx-auto mb-4 ${
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
                    <span>Download Original Manual</span>
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
          </div>
        )}
      </div>
    </div>
  );
}
