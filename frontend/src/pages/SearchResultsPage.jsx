import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useOutletContext } from 'react-router-dom';
import { Search, Folder, ArrowRight, Eye, FileText } from 'lucide-react';
import api from '../services/api';

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const navigate = useNavigate();
  const { openDocument } = useOutletContext() || {};

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'DOCS' | 'FOLDERS'

  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults({ documents: [], folders: [], total: 0 });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await api.get(`/search?q=${encodeURIComponent(query.trim())}&limit=50`);
        if (res.data.success) {
          setResults(res.data);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-0">
      {/* Header Banner */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-xs transition-colors">
        <div className="flex items-center space-x-2 text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
          <Search className="w-3.5 h-3.5" />
          <span>GLOBAL REPOSITORY SEARCH</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] break-words">
          Search Results for &ldquo;{query}&rdquo;
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Found <strong className="text-[var(--text-primary)]">{results?.total || 0}</strong> matches across authorized folders, titles, systems, order numbers, and catalogue codes.
        </p>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[var(--border-subtle)] text-xs">
          <button
            onClick={() => setFilterType('ALL')}
            className={`flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] px-3.5 py-2 font-medium transition-colors cursor-pointer text-center ${
              filterType === 'ALL'
                ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                : 'bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--text-secondary)]'
            }`}
          >
            All ({results?.total || 0})
          </button>
          <button
            onClick={() => setFilterType('DOCS')}
            className={`flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] px-3.5 py-2 font-medium transition-colors cursor-pointer text-center ${
              filterType === 'DOCS'
                ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                : 'bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--text-secondary)]'
            }`}
          >
            Documents ({results?.documents?.length || 0})
          </button>
          <button
            onClick={() => setFilterType('FOLDERS')}
            className={`flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] px-3.5 py-2 font-medium transition-colors cursor-pointer text-center ${
              filterType === 'FOLDERS'
                ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                : 'bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--text-secondary)]'
            }`}
          >
            Folders ({results?.folders?.length || 0})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--text-muted)] border border-[var(--border-color)] bg-[var(--bg-card)]">
          Searching documents, order numbers, and systems...
        </div>
      ) : results?.total === 0 ? (
        <div className="p-12 text-center text-xs text-[var(--text-muted)] border border-[var(--border-color)] bg-[var(--bg-card)]">
          <Search className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] opacity-50" />
          <h3 className="font-semibold text-sm text-[var(--text-primary)]">No matching records found</h3>
          <p className="mt-1 text-[var(--text-secondary)]">Try searching for Siemens model numbers (e.g. 840D, S120), order numbers, or file codes.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Folders List */}
          {(filterType === 'ALL' || filterType === 'FOLDERS') && results?.folders?.length > 0 && (
            <div className="border border-[var(--border-color)] bg-[var(--bg-card)] transition-colors">
              <div className="border-b border-[var(--border-color)] px-4 py-2.5 bg-[var(--bg-hover)] text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] flex items-center justify-between">
                <span>Matching Folders ({results.folders.length})</span>
                <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">Click to open repository</span>
              </div>
              <div className="divide-y divide-[var(--border-subtle)]">
                {results.folders.map((folder) => (
                  <div
                    key={folder._id}
                    onClick={() => navigate(`/library/${folder._id}`)}
                    className="p-3.5 hover:bg-[var(--bg-hover)] cursor-pointer flex items-center justify-between transition-colors text-xs group"
                  >
                    <div className="flex items-center space-x-3 truncate mr-4 min-w-0">
                      <Folder className="w-4 h-4 text-[var(--text-primary)] shrink-0" />
                      <div className="truncate min-w-0">
                        <div className="font-semibold text-[var(--text-primary)] group-hover:underline truncate">
                          {folder.name}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5 truncate">
                          {folder.path}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents Table */}
          {(filterType === 'ALL' || filterType === 'DOCS') && results?.documents?.length > 0 && (
            <div className="border border-[var(--border-color)] bg-[var(--bg-card)] transition-colors">
              <div className="border-b border-[var(--border-color)] px-4 py-2.5 bg-[var(--bg-hover)] text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] flex items-center justify-between">
                <span>Matching Catalogue Documents ({results.documents.length})</span>
                <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">Click to preview document</span>
              </div>

              {/* Mobile Card View (visible on screens < 640px) */}
              <div className="block sm:hidden divide-y divide-[var(--border-subtle)]">
                {results.documents.map((doc) => (
                  <div
                    key={doc._id}
                    onClick={() => openDocument && openDocument(doc)}
                    className="p-3.5 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-primary)]">
                        {doc.system || 'SIEMENS'}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--badge-bg)] text-[var(--text-muted)]">
                        {doc.documentCode || doc.originalFileName?.slice(0, 6) || 'PDF'}
                      </span>
                    </div>
                    <div className="font-medium text-xs text-[var(--text-primary)] hover:underline leading-snug">
                      {doc.title}
                    </div>
                    {doc.orderNumber && (
                      <div className="text-[11px] font-mono text-[var(--text-muted)]">
                        Order: {doc.orderNumber}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--text-muted)]">
                      <span>Ed: {doc.edition || '—'}</span>
                      <span className="inline-flex items-center space-x-1 text-[var(--text-primary)] font-semibold">
                        <Eye className="w-3 h-3" />
                        <span>Preview</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop & Tablet Table (visible on screens >= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[760px]">
                  <thead>
                    <tr className="bg-[var(--table-header-bg)] text-[var(--table-header-text)] font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3 border-r border-[var(--border-subtle)]">System</th>
                      <th className="py-2.5 px-4 border-r border-[var(--border-subtle)]">Document Title</th>
                      <th className="py-2.5 px-2.5 border-r border-[var(--border-subtle)] text-center">SW</th>
                      <th className="py-2.5 px-2.5 border-r border-[var(--border-subtle)] text-center">Edition</th>
                      <th className="py-2.5 px-3 border-r border-[var(--border-subtle)]">Order No.</th>
                      <th className="py-2.5 px-3 border-r border-[var(--border-subtle)] text-center">File Code</th>
                      <th className="py-2.5 px-3 border-r border-[var(--border-subtle)]">Folder Location</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {results.documents.map((doc, idx) => (
                      <tr
                        key={doc._id}
                        onClick={() => openDocument && openDocument(doc)}
                        className={`hover:bg-[var(--table-row-hover)] cursor-pointer transition-colors ${
                          idx % 2 === 1 ? 'bg-[var(--bg-hover)]' : 'bg-[var(--bg-card)]'
                        }`}
                      >
                        <td className="py-2 px-3 border-r border-[var(--border-subtle)] font-mono text-[11px]">
                          <span className="bg-[var(--bg-card)] border border-[var(--border-color)] px-1 py-0.5 text-[var(--text-primary)]">
                            {doc.system || '—'}
                          </span>
                        </td>
                        <td className="py-2 px-4 border-r border-[var(--border-subtle)] text-[var(--text-primary)]">
                          <div className="font-medium hover:underline">
                            {doc.title}
                          </div>
                          {doc.description && (
                            <div className="text-[11px] text-[var(--text-muted)] truncate max-w-xs mt-0.5">
                              {doc.description}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2.5 border-r border-[var(--border-subtle)] text-center font-mono text-[11px] text-[var(--text-secondary)]">
                          {doc.softwareVersion || '—'}
                        </td>
                        <td className="py-2 px-2.5 border-r border-[var(--border-subtle)] text-center font-mono text-[11px] text-[var(--text-secondary)]">
                          {doc.edition || '—'}
                        </td>
                        <td className="py-2 px-3 border-r border-[var(--border-subtle)] font-mono text-[11px] text-[var(--text-primary)]">
                          {doc.orderNumber || '—'}
                        </td>
                        <td className="py-2 px-3 border-r border-[var(--border-subtle)] text-center font-mono font-bold text-[11px]">
                          <span className="bg-[var(--badge-bg)] px-1 py-0.5 border border-[var(--border-color)] text-[var(--text-primary)]">
                            {doc.documentCode || doc.originalFileName?.slice(0, 6)}
                          </span>
                        </td>
                        <td className="py-2 px-3 border-r border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] truncate max-w-[120px]">
                          {doc.folderId?.name || 'Library'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="border border-[var(--border-color)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-colors inline-block">
                            Preview
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
