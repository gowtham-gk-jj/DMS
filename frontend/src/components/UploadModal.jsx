import React, { useState, useRef } from 'react';
import { X, Upload, AlertCircle, Loader2 } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        className={`border max-w-xl w-full shadow-2xl max-h-[92vh] flex flex-col ${
          isDark
            ? 'bg-[#141c2b] border-[#334155] text-[#f8fafc]'
            : 'bg-[#ffffff] border-[#111111] text-[#111111]'
        }`}
      >
        {/* Modal Top Bar */}
        <div
          className={`px-4 sm:px-5 py-3 flex items-center justify-between border-b ${
            isDark
              ? 'bg-[#0f172a] border-[#243042] text-[#f8fafc]'
              : 'bg-[#111111] border-[#111111] text-[#ffffff]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Upload className="w-4 h-4" />
            <h3 className="font-semibold text-xs sm:text-sm">Upload & Catalog Technical Documents</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close upload modal"
            className="p-1 hover:opacity-75 transition-opacity cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div
              className={`p-3 border text-xs flex items-center space-x-2 ${
                isDark
                  ? 'bg-[#451a1a] border-[#b91c1c] text-[#fca5a5]'
                  : 'bg-[#fafafa] border-[#111111] text-[#111111]'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <span className={`block text-[11px] mb-0.5 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
              Destination Folder:
            </span>
            <span className="font-mono font-semibold text-xs">{folderName || 'Selected Folder'}</span>
          </div>

          {/* Drag & Drop File Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed p-4 sm:p-6 text-center cursor-pointer transition-colors ${
              isDark
                ? 'border-[#334155] bg-[#0f172a] hover:bg-[#162032]'
                : 'border-[#cccccc] bg-[#fafafa] hover:bg-[#f0f0f0]'
            }`}
          >
            <Upload
              className={`w-8 h-8 mx-auto mb-2 ${
                isDark ? 'text-[#60a5fa]' : 'text-[#777777]'
              }`}
            />
            <p className="font-semibold text-xs">
              {files.length > 0
                ? `${files.length} document file(s) selected`
                : 'Click or drag technical manuals here'}
            </p>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
              Supports PDF, DOC, DOCX, XLS, XLSX, Images, CAD drawings (up to 20 files per batch)
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
            <div
              className={`border p-2.5 max-h-28 overflow-y-auto text-[11px] space-y-1 ${
                isDark ? 'bg-[#0f172a] border-[#243042]' : 'bg-[#fafafa] border-[#e5e5e5]'
              }`}
            >
              {files.map((f, i) => (
                <div key={i} className="flex justify-between font-mono truncate">
                  <span className="truncate mr-2">{f.name}</span>
                  <span className={isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}>
                    {(f.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Progress Bar */}
          {uploading && (
            <div className="space-y-1">
              <div
                className={`flex justify-between text-[11px] ${
                  isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                }`}
              >
                <span>Uploading documents...</span>
                <span>{progress}%</span>
              </div>
              <div
                className={`w-full h-1.5 overflow-hidden ${
                  isDark ? 'bg-[#1e293b]' : 'bg-[#e5e5e5]'
                }`}
              >
                <div
                  className={`h-full transition-all duration-200 ${
                    isDark ? 'bg-[#60a5fa]' : 'bg-[#111111]'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* DOConCD Catalogue Metadata Inputs: 1 col on mobile, 2 on tablet/desktop */}
          <div className={`border-t pt-3 ${isDark ? 'border-[#243042]' : 'border-[#e5e5e5]'}`}>
            <div className="font-semibold uppercase tracking-wider text-[11px] mb-3">
              Catalogue Metadata (Siemens DOConCD Format)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block mb-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Operating Manual Universal"
                  disabled={uploading}
                  className={`w-full border p-2 text-xs focus:outline-none rounded-none ${
                    isDark
                      ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                      : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
                  }`}
                />
              </div>

              <div>
                <label className={`block mb-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                  System Platform
                </label>
                <input
                  type="text"
                  value={system}
                  onChange={(e) => setSystem(e.target.value)}
                  placeholder="e.g. 840D sl / SINAMICS S120"
                  disabled={uploading}
                  className={`w-full border p-2 text-xs focus:outline-none rounded-none ${
                    isDark
                      ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                      : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
                  }`}
                />
              </div>

              <div>
                <label className={`block mb-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                  Catalogue Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={uploading}
                  className={`w-full border p-2 text-xs focus:outline-none rounded-none ${
                    isDark
                      ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                      : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
                  }`}
                >
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block mb-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                  Siemens Order Number
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="e.g. 6FC5398-6AP40-0BA0"
                  disabled={uploading}
                  className={`w-full border p-2 text-xs font-mono focus:outline-none rounded-none ${
                    isDark
                      ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                      : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
                  }`}
                />
              </div>

              <div>
                <label className={`block mb-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                  Document Code / Short Name
                </label>
                <input
                  type="text"
                  value={documentCode}
                  onChange={(e) => setDocumentCode(e.target.value)}
                  placeholder="e.g. BHUsl"
                  disabled={uploading}
                  className={`w-full border p-2 text-xs font-mono focus:outline-none rounded-none ${
                    isDark
                      ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                      : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block mb-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                    SW Version
                  </label>
                  <input
                    type="text"
                    value={softwareVersion}
                    onChange={(e) => setSoftwareVersion(e.target.value)}
                    placeholder="e.g. 2.7"
                    disabled={uploading}
                    className={`w-full border p-2 text-xs font-mono focus:outline-none rounded-none ${
                      isDark
                        ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                        : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block mb-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                    Edition
                  </label>
                  <input
                    type="text"
                    value={edition}
                    onChange={(e) => setEdition(e.target.value)}
                    placeholder="e.g. 02/11"
                    disabled={uploading}
                    className={`w-full border p-2 text-xs font-mono focus:outline-none rounded-none ${
                      isDark
                        ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                        : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
                    }`}
                  />
                </div>
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className={`block mb-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                  Description / Remarks
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of document content, revisions, or application note..."
                  disabled={uploading}
                  className={`w-full border p-2 text-xs focus:outline-none rounded-none ${
                    isDark
                      ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                      : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
                  }`}
                />
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className={`block mb-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
                  Tags (Comma-separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="CNC, Lathe, Sinamics, Commissioning"
                  disabled={uploading}
                  className={`w-full border p-2 text-xs focus:outline-none rounded-none ${
                    isDark
                      ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                      : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            className={`border-t pt-4 flex items-center justify-end space-x-3 ${
              isDark ? 'border-[#243042]' : 'border-[#e5e5e5]'
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className={`px-4 py-2.5 min-h-[44px] text-xs border rounded-none cursor-pointer transition-colors ${
                isDark
                  ? 'border-[#334155] text-[#cbd5e1] hover:bg-[#1e293b]'
                  : 'border-[#cccccc] text-[#111111] hover:bg-[#f5f5f5]'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || files.length === 0}
              className={`px-5 py-2.5 min-h-[44px] text-xs font-semibold rounded-none disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer transition-colors ${
                isDark
                  ? 'bg-[#f8fafc] text-[#0b0f17] hover:bg-[#e2e8f0]'
                  : 'bg-[#111111] text-[#ffffff] hover:bg-[#333333]'
              }`}
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
