import React, { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function CreateFolderModal({ parentFolderId = null, parentName = 'Root Library', onClose, onCreated }) {
  const { isDark } = useTheme();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Folder name is required.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const res = await api.post('/folders', {
        name: name.trim(),
        code: code.trim(),
        description: description.trim(),
        parentFolderId: parentFolderId || null,
      });

      if (res.data.success) {
        if (onCreated) onCreated(res.data.folder);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create folder.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4">
      <div className="dms-card max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-elevated)]">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]">
              <FolderPlus className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-xs sm:text-sm text-[var(--text-primary)]">Create New Folder</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create folder modal"
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)] text-xs">
              {error}
            </div>
          )}

          <div>
            <span className="block text-[11px] font-mono text-[var(--text-muted)] mb-1">
              Parent Location:
            </span>
            <span className="font-semibold text-xs text-[var(--text-primary)]">{parentName}</span>
          </div>

          <div>
            <label className="block mb-1 font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono text-[11px]">
              Folder Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Commissioning, Diagnostics, Training"
              required
              className="dms-input"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono text-[11px]">
              Folder Code / Identifier (Optional)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. DOConCD_SINUMERIK_COMM"
              className="dms-input font-mono"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono text-[11px]">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the folder's technical scope..."
              className="dms-input min-h-[64px]"
            />
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-4 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="dms-btn-secondary px-4 py-2 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="dms-btn-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider"
            >
              {saving ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
