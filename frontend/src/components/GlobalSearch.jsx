import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Folder, X, ExternalLink, ArrowRight, Loader2 } from 'lucide-react';
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
        <Search className="absolute left-3 w-4 h-4 pointer-events-none text-[var(--text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search technical documents, folders, order numbers..."
          className="w-full text-xs sm:text-sm pl-9 pr-10 sm:pr-16 py-2 min-h-[44px] sm:min-h-[38px] rounded-md border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all focus:outline-none focus:border-[var(--primary-blue)] focus:ring-1 focus:ring-[var(--primary-blue)]"
        />
        <div className="absolute right-1.5 sm:right-2 flex items-center space-x-1">
          {loading && (
            <Loader2 className="w-4 h-4 animate-spin text-[var(--primary-blue)] mr-1" />
          )}
          {query && !loading && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults(null);
                setIsOpen(false);
              }}
              aria-label="Clear search input"
              className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 border rounded-xs select-none font-mono bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-color)]">
            ⌘K
          </span>
        </div>
      </div>

      {/* Instant Search Results Dropdown */}
      {isOpen && results && (
        <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 lg:left-0 lg:right-auto top-[58px] sm:top-full mt-1.5 sm:w-[460px] md:w-[500px] lg:w-[560px] max-w-[calc(100vw-24px)] border border-[var(--border-color)] rounded-lg shadow-xl z-50 max-h-[75vh] sm:max-h-[480px] overflow-y-auto bg-[var(--bg-card)] text-[var(--text-primary)]">
          {/* Matching Folders */}
          {results.folders?.length > 0 && (
            <div className="p-2 border-b border-[var(--border-color)]">
              <div className="text-[11px] font-semibold uppercase tracking-wider px-2 py-1 text-[var(--text-muted)] font-mono">
                Folders ({results.folders.length})
              </div>
              <div className="space-y-0.5">
                {results.folders.map((f) => (
                  <button
                    key={f._id}
                    onClick={() => handleFolderClick(f._id)}
                    className="w-full text-left px-2.5 py-2 flex items-center justify-between text-xs rounded-md transition-colors cursor-pointer hover:bg-[var(--bg-hover)] group"
                  >
                    <div className="flex items-center space-x-2.5 truncate min-w-0">
                      <Folder className="w-4 h-4 shrink-0 text-[var(--primary-blue)]" />
                      <span className="font-medium truncate text-[var(--text-primary)]">
                        {f.name}
                      </span>
                      <span className="text-[11px] truncate text-[var(--text-muted)] font-mono">
                        {f.path}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--primary-blue)] group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matching Documents */}
          {results.documents?.length > 0 && (
            <div className="p-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider px-2 py-1 text-[var(--text-muted)] font-mono">
                Catalogue Documents ({results.documents.length})
              </div>
              <div className="space-y-0.5">
                {results.documents.map((doc) => (
                  <button
                    key={doc._id}
                    onClick={() => handleDocumentClick(doc)}
                    className="w-full text-left p-2.5 flex items-start justify-between text-xs rounded-md transition-colors cursor-pointer hover:bg-[var(--bg-hover)] group"
                  >
                    <div className="flex items-start space-x-2.5 truncate mr-2 min-w-0">
                      <FileText className="w-4 h-4 shrink-0 mt-0.5 text-[var(--primary-blue)]" />
                      <div className="truncate min-w-0">
                        <div className="font-medium truncate text-[var(--text-primary)] group-hover:text-[var(--primary-blue)] transition-colors">
                          {doc.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] mt-1 text-[var(--text-secondary)]">
                          {doc.system && (
                            <span className="border border-[var(--border-color)] px-1.5 py-0.2 rounded-xs font-mono text-[10px] bg-[var(--bg-elevated)] text-[var(--text-primary)]">
                              {doc.system}
                            </span>
                          )}
                          {doc.fileName && (
                            <span className="font-mono text-[11px] font-medium text-[var(--text-secondary)]">
                              {doc.fileName}
                            </span>
                          )}
                          {doc.orderNumber && (
                            <span className="truncate font-mono text-[11px] text-[var(--text-muted)]">
                              Ord: {doc.orderNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-[11px] shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] mt-0.5">
                      <span className="hidden sm:inline">Open</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.folders?.length === 0 && results.documents?.length === 0 && (
            <div className="p-8 text-center text-xs text-[var(--text-secondary)]">
              No documents or folders match &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Footer View All */}
          <div className="border-t border-[var(--border-color)] p-2.5 text-center bg-[var(--bg-elevated)] rounded-b-lg">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate(`/search?q=${encodeURIComponent(query.trim())}`);
              }}
              className="text-xs font-medium text-[var(--primary-blue)] hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <span>View all results for &ldquo;{query}&rdquo;</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
