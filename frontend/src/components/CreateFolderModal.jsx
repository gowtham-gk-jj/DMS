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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        className={`border max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto ${
          isDark
            ? 'bg-[#141c2b] border-[#334155] text-[#f8fafc]'
            : 'bg-[#ffffff] border-[#111111] text-[#111111]'
        }`}
      >
        <div
          className={`px-4 sm:px-5 py-3 flex items-center justify-between border-b ${
            isDark
              ? 'bg-[#0f172a] border-[#243042] text-[#f8fafc]'
              : 'bg-[#111111] border-[#111111] text-[#ffffff]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <FolderPlus className="w-4 h-4" />
            <h3 className="font-semibold text-xs sm:text-sm">Create New Folder</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create folder modal"
            className="p-1 hover:opacity-75 transition-opacity cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
          {error && (
            <div
              className={`p-2.5 border ${
                isDark
                  ? 'bg-[#451a1a] border-[#b91c1c] text-[#fca5a5]'
                  : 'bg-[#fafafa] border-[#111111] text-[#111111]'
              }`}
            >
              {error}
            </div>
          )}

          <div>
            <span className={`block text-[11px] mb-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
              Parent Location:
            </span>
            <span className="font-semibold text-xs">{parentName}</span>
          </div>

          <div>
            <label className={`block mb-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
              Folder Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Commissioning, Diagnostics, Training"
              required
              className={`w-full border p-2 text-xs focus:outline-none rounded-none ${
                isDark
                  ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                  : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
              }`}
            />
          </div>

          <div>
            <label className={`block mb-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
              Folder Code / Identifier (Optional)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. DOConCD_SINUMERIK_COMM"
              className={`w-full border p-2 text-xs font-mono focus:outline-none rounded-none ${
                isDark
                  ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                  : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
              }`}
            />
          </div>

          <div>
            <label className={`block mb-1 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the folder's technical scope..."
              className={`w-full border p-2 text-xs focus:outline-none rounded-none ${
                isDark
                  ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc] focus:border-[#60a5fa]'
                  : 'bg-[#ffffff] border-[#cccccc] text-[#111111] focus:border-[#111111]'
              }`}
            />
          </div>

          <div
            className={`border-t pt-3 flex items-center justify-end space-x-2 ${
              isDark ? 'border-[#243042]' : 'border-[#e5e5e5]'
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={`px-4 py-1.5 border rounded-none cursor-pointer transition-colors ${
                isDark
                  ? 'border-[#334155] text-[#cbd5e1] hover:bg-[#1e293b]'
                  : 'border-[#cccccc] text-[#111111] hover:bg-[#f5f5f5]'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className={`px-4 py-1.5 font-semibold uppercase tracking-wider rounded-none cursor-pointer disabled:opacity-50 transition-colors ${
                isDark
                  ? 'bg-[#f8fafc] text-[#0b0f17] hover:bg-[#e2e8f0]'
                  : 'bg-[#111111] text-[#ffffff] hover:bg-[#333333]'
              }`}
            >
              {saving ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
