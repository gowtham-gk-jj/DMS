import React, { useState, useRef } from 'react';
import { X, Upload, AlertCircle, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';

const DEFAULT_CATEGORIES = [
  'Operation',
  'Programming',
  'Commissioning',
  'Functions',
  'SIMATIC',
  'Info / Training',
  'Hardware / Installation',
  'Service & Diagnostics',
  'General',
];

export default function UploadModal({ folderId, folderName, defaultSystem = '', onClose, onUploaded }) {
  const { isDark } = useTheme();
  const [files, setFiles] = useState([]);
  const [system, setSystem] = useState(defaultSystem);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Operation');
  const [softwareVersion, setSoftwareVersion] = useState('');
  const [edition, setEdition] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [documentCode, setDocumentCode] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      setFiles(selected);
      if (!title && selected.length === 1) {
        setTitle(selected[0].name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length > 0) {
      setFiles(dropped);
      if (!title && dropped.length === 1) {
        setTitle(dropped[0].name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Please select at least one file to upload.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setProgress(10);

      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      if (title.trim()) formData.append('title', title.trim());
      if (system.trim()) formData.append('system', system.trim());
      if (category.trim()) formData.append('category', category.trim());
      if (softwareVersion.trim()) formData.append('softwareVersion', softwareVersion.trim());
      if (edition.trim()) formData.append('edition', edition.trim());
      if (orderNumber.trim()) formData.append('orderNumber', orderNumber.trim());
      if (documentCode.trim()) formData.append('documentCode', documentCode.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (tags.trim()) formData.append('tags', tags.trim());

      setProgress(40);
      const res = await api.post(`/documents/folder/${folderId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(Math.min(pct, 95));
          }
        },
      });

      setProgress(100);
      if (res.data.success) {
        if (onUploaded) onUploaded();
        onClose();
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.message || 'Failed to upload document(s).');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4">
      <div className="dms-card max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-elevated)]">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]">
              <Upload className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-xs sm:text-sm text-[var(--text-primary)]">
              Upload & Catalog Technical Documents
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close upload modal"
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {error && (
            <div className="p-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)] text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <span className="block text-[11px] font-mono text-[var(--text-muted)] mb-0.5">
              Destination Folder:
            </span>
            <span className="font-mono font-semibold text-xs text-[var(--text-primary)]">
              {folderName || 'Selected Folder'}
            </span>
          </div>

          {/* Drag & Drop File Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--border-color)] hover:border-[var(--primary-blue)] rounded-lg p-5 sm:p-6 text-center cursor-pointer transition-colors bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]"
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--primary-blue)]" />
            <p className="font-semibold text-xs text-[var(--text-primary)]">
              {files.length > 0
                ? `${files.length} document file(s) selected`
                : 'Click or drag technical manuals here'}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Supports PDF, DOC, DOCX, XLS, XLSX, Images (up to 20 files per batch)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Selected Files List */}
          {files.length > 0 && (
            <div className="rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] p-3 max-h-28 overflow-y-auto text-[11px] space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex justify-between font-mono truncate text-[var(--text-secondary)]">
                  <span className="truncate mr-2 text-[var(--text-primary)]">{f.name}</span>
                  <span className="text-[var(--text-muted)]">
                    {(f.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Progress Bar */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-[var(--text-secondary)]">
                <span>Uploading documents...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-color)]">
                <div
                  className="h-full bg-[var(--primary-blue)] transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* DOConCD Catalogue Metadata Inputs: 1 col on mobile, 2 on tablet/desktop */}
          <div className="border-t border-[var(--border-subtle)] pt-4">
            <div className="font-semibold uppercase tracking-wider text-[11px] mb-3 text-[var(--text-primary)] font-mono">
              Catalogue Metadata (Siemens DOConCD Format)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Operating Manual Universal"
                  disabled={uploading}
                  className="dms-input"
                />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                  System Platform
                </label>
                <input
                  type="text"
                  value={system}
                  onChange={(e) => setSystem(e.target.value)}
                  placeholder="e.g. 840D sl / SINAMICS S120"
                  disabled={uploading}
                  className="dms-input"
                />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                  Catalogue Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={uploading}
                  className="dms-input"
                >
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                  Siemens Order Number
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="e.g. 6FC5398-6AP40-0BA0"
                  disabled={uploading}
                  className="dms-input font-mono"
                />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                  Document Code / Short Name
                </label>
                <input
                  type="text"
                  value={documentCode}
                  onChange={(e) => setDocumentCode(e.target.value)}
                  placeholder="e.g. BHUsl"
                  disabled={uploading}
                  className="dms-input font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                    SW Version
                  </label>
                  <input
                    type="text"
                    value={softwareVersion}
                    onChange={(e) => setSoftwareVersion(e.target.value)}
                    placeholder="e.g. 2.7"
                    disabled={uploading}
                    className="dms-input font-mono"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                    Edition
                  </label>
                  <input
                    type="text"
                    value={edition}
                    onChange={(e) => setEdition(e.target.value)}
                    placeholder="e.g. 02/11"
                    disabled={uploading}
                    className="dms-input font-mono"
                  />
                </div>
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                  Description / Remarks
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of document content, revisions, or application note..."
                  disabled={uploading}
                  className="dms-input min-h-[58px]"
                />
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                  Tags (Comma-separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="CNC, Lathe, Sinamics, Commissioning"
                  disabled={uploading}
                  className="dms-input"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-[var(--border-subtle)] pt-4 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="dms-btn-secondary px-4 py-2 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || files.length === 0}
              className="dms-btn-primary px-5 py-2 text-xs font-semibold uppercase tracking-wider"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload & Catalog</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
