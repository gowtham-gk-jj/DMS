import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Folder, X, ExternalLink, ArrowRight } from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function GlobalSearch({ onSelectDocument }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const { isDark } = useTheme();

  // Keyboard shortcut Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.querySelector('input')?.focus();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(query.trim())}&limit=8`);
        if (res.data.success) {
          setResults(res.data);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      setIsOpen(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleDocumentClick = (doc) => {
    setIsOpen(false);
    if (onSelectDocument) {
      onSelectDocument(doc);
    } else {
      navigate(`/library/${doc.folderId?._id || doc.folderId}?doc=${doc._id}`);
    }
  };

  const handleFolderClick = (folderId) => {
    setIsOpen(false);
    navigate(`/library/${folderId}`);
  };

  return (
    <div className="relative w-full max-w-xl" ref={searchRef}>
      <div className="relative flex items-center">
        <Search
          className={`absolute left-2.5 sm:left-3 w-4 h-4 pointer-events-none ${
            isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
          }`}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search catalogue (Ctrl+K)..."
          className={`w-full text-xs sm:text-sm pl-8 sm:pl-9 pr-12 sm:pr-16 py-1.5 sm:py-2 border rounded-none transition-colors focus:outline-none ${
            isDark
              ? 'bg-[#0f172a] text-[#f8fafc] placeholder-[#64748b] border-[#334155] focus:border-[#60a5fa]'
              : 'bg-[#ffffff] text-[#111111] placeholder-[#777777] border-[#cccccc] focus:border-[#111111]'
          }`}
        />
        <div className="absolute right-2 flex items-center space-x-1">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults(null);
                setIsOpen(false);
              }}
              aria-label="Clear search input"
              className={`p-1 cursor-pointer transition-colors ${
                isDark ? 'text-[#94a3b8] hover:text-[#f8fafc]' : 'text-[#777777] hover:text-[#111111]'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <span
            className={`hidden sm:inline-block text-[10px] px-1.5 py-0.5 border rounded-none select-none font-mono ${
              isDark
                ? 'bg-[#1e293b] text-[#94a3b8] border-[#334155]'
                : 'bg-[#f5f5f5] text-[#777777] border-[#e5e5e5]'
            }`}
          >
            ⌘K
          </span>
        </div>
      </div>

      {/* Instant Search Results Dropdown */}
      {isOpen && results && (
        <div
          className={`absolute left-0 right-0 sm:left-auto sm:right-auto sm:w-[480px] md:w-[560px] max-w-[95vw] top-full mt-1 border shadow-2xl z-50 max-h-[480px] overflow-y-auto ${
            isDark
              ? 'bg-[#141c2b] border-[#334155] text-[#f8fafc]'
              : 'bg-[#ffffff] border-[#111111] text-[#111111]'
          }`}
        >
          {loading && (
            <div
              className={`p-3 text-xs border-b ${
                isDark ? 'text-[#94a3b8] border-[#243042]' : 'text-[#777777] border-[#e5e5e5]'
              }`}
            >
              Searching catalogue...
            </div>
          )}

          {/* Matching Folders */}
          {results.folders?.length > 0 && (
            <div
              className={`p-2 border-b ${
                isDark ? 'border-[#243042]' : 'border-[#e5e5e5]'
              }`}
            >
              <div
                className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-1 ${
                  isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                }`}
              >
                Folders ({results.folders.length})
              </div>
              <div className="space-y-0.5">
                {results.folders.map((f) => (
                  <button
                    key={f._id}
                    onClick={() => handleFolderClick(f._id)}
                    className={`w-full text-left px-2 py-1.5 flex items-center justify-between text-xs group transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-[#1e293b]' : 'hover:bg-[#f5f5f5]'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate min-w-0">
                      <Folder
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isDark ? 'text-[#60a5fa]' : 'text-[#111111]'
                        }`}
                      />
                      <span
                        className={`font-medium truncate ${
                          isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                        }`}
                      >
                        {f.name}
                      </span>
                      <span
                        className={`text-[11px] truncate ${
                          isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                        }`}
                      >
                        {f.path}
                      </span>
                    </div>
                    <ArrowRight
                      className={`w-3 h-3 shrink-0 ${
                        isDark ? 'text-[#64748b] group-hover:text-[#f8fafc]' : 'text-[#777777] group-hover:text-[#111111]'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matching Documents */}
          {results.documents?.length > 0 && (
            <div className="p-2">
              <div
                className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-1 ${
                  isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                }`}
              >
                Catalogue Documents ({results.documents.length})
              </div>
              <div className="space-y-0.5">
                {results.documents.map((doc) => (
                  <button
                    key={doc._id}
                    onClick={() => handleDocumentClick(doc)}
                    className={`w-full text-left p-2 flex items-start justify-between text-xs group transition-colors border-b cursor-pointer ${
                      isDark
                        ? 'border-transparent hover:border-[#243042] hover:bg-[#1e293b]'
                        : 'border-transparent hover:border-[#e5e5e5] hover:bg-[#f5f5f5]'
                    }`}
                  >
                    <div className="flex items-start space-x-2.5 truncate mr-2 min-w-0">
                      <FileText
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isDark ? 'text-[#60a5fa]' : 'text-[#111111]'
                        }`}
                      />
                      <div className="truncate min-w-0">
                        <div
                          className={`font-medium truncate ${
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
                                  : 'bg-[#fafafa] text-[#111111] border-[#e5e5e5]'
                              }`}
                            >
                              {doc.system}
                            </span>
                          )}
                          {doc.fileName && (
                            <span
                              className={`font-mono text-[10px] font-semibold ${
                                isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                              }`}
                            >
                              {doc.fileName}
                            </span>
                          )}
                          {doc.orderNumber && (
                            <span className="truncate">Ord: {doc.orderNumber}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`flex items-center space-x-1 text-[11px] shrink-0 ${
                        isDark ? 'text-[#94a3b8] group-hover:text-[#f8fafc]' : 'text-[#777777] group-hover:text-[#111111]'
                      }`}
                    >
                      <span className="hidden sm:inline">Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.folders?.length === 0 && results.documents?.length === 0 && (
            <div
              className={`p-6 text-center text-xs ${
                isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
              }`}
            >
              No documents or folders match "{query}"
            </div>
          )}

          {/* Footer View All */}
          <div
            className={`border-t p-2 text-center ${
              isDark
                ? 'bg-[#111827] border-[#243042]'
                : 'bg-[#fafafa] border-[#e5e5e5]'
            }`}
          >
            <button
              onClick={() => {
                setIsOpen(false);
                navigate(`/search?q=${encodeURIComponent(query.trim())}`);
              }}
              className={`text-xs font-medium hover:underline cursor-pointer ${
                isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
              }`}
            >
              View all results for "{query}" →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
