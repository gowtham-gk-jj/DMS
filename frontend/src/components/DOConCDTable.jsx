import React, { useState, useMemo } from 'react';
import {
  FileText,
  Eye,
  Download,
  ChevronDown,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// Exact Siemens DOConCD PDF Category Ordering
const ORDERED_CATEGORIES = [
  '840D sl/840Di sl/828D User / Operation',
  '840D sl/840Di sl/828D User / Programming',
  '840D sl/840Di sl Manufacturer/Service / Configuring',
  '840D sl/840Di sl Manufacturer/Service / Commissioning',
  'Functions',
  '828D Manufacturer/Service / Version 4.3',
  '828D Manufacturer/Service / Version 2.6',
  '802D sl / User',
  '802D sl / Manufacturer/Service',
  'SINAMICS S120',
  'Measuring Systems',
  'Synchronous motors',
  'Asynchronous motors',
  'Linear/Torque Motors',
  'Motion Control Information System',
  'ePS Network Services',
  'SIMATIC',
  'Info/Training',
  'Control system overview',
];

export default function DOConCDTable({
  documents = [],
  availableCategories = [],
  availableSystems = [],
  userPermissions = {},
  onSelectDocument,
  onDownloadDocument,
}) {
  const { isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSystem, setSelectedSystem] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [pageSize, setPageSize] = useState(25);
  const [categoryPages, setCategoryPages] = useState({});
  const [unavailableModalDoc, setUnavailableModalDoc] = useState(null);

  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const handlePageChange = (cat, page) => {
    setCategoryPages((prev) => ({
      ...prev,
      [cat]: page,
    }));
  };

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const catPath = doc.subcategory ? `${doc.category} / ${doc.subcategory}` : doc.category;
      if (selectedCategory !== 'ALL' && doc.category !== selectedCategory && catPath !== selectedCategory) {
        return false;
      }
      if (selectedSystem !== 'ALL' && doc.system !== selectedSystem) {
        return false;
      }
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase();
        const matchesTitle = doc.title?.toLowerCase().includes(query);
        const matchesSystem = doc.system?.toLowerCase().includes(query);
        const matchesOrder = doc.orderNumber?.toLowerCase().includes(query);
        const matchesCode = (doc.documentCode || doc.fileName)?.toLowerCase().includes(query);
        const matchesFile = doc.originalFileName?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesSystem && !matchesOrder && !matchesCode && !matchesFile) {
          return false;
        }
      }
      return true;
    });
  }, [documents, selectedCategory, selectedSystem, searchFilter]);

  // Group filtered documents by Category while preserving exact Siemens PDF Order!
  const filteredGrouped = useMemo(() => {
    const groups = {};

    filteredDocuments.forEach((doc) => {
      const catKey = doc.subcategory ? `${doc.category} / ${doc.subcategory}` : (doc.category || 'General');
      if (!groups[catKey]) {
        groups[catKey] = [];
      }
      groups[catKey].push(doc);
    });

    // Sort items within each category strictly by original displayOrder
    Object.keys(groups).forEach((cat) => {
      groups[cat].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    });

    return groups;
  }, [filteredDocuments]);

  // Ordered list of categories to display
  const categoriesToRender = useMemo(() => {
    const presentKeys = Object.keys(filteredGrouped);
    // Sort according to ORDERED_CATEGORIES, then any unknown at the end
    return presentKeys.sort((a, b) => {
      const idxA = ORDERED_CATEGORIES.indexOf(a);
      const idxB = ORDERED_CATEGORIES.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [filteredGrouped]);

  const handleRowClick = (doc) => {
    if (doc.availabilityStatus === 'FILE_NOT_FOUND' || !doc.secureUrl) {
      setUnavailableModalDoc(doc);
    } else if (onSelectDocument) {
      onSelectDocument(doc);
    }
  };

  return (
    <div
      className={`w-full border font-sans shadow-xs transition-colors duration-150 ${
        isDark
          ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
          : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
      }`}
    >
      {/* Siemens-Style Quick Filter Bar */}
      <div
        className={`border-b p-3 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 text-xs ${
          isDark
            ? 'bg-[#111827] border-[#243042]'
            : 'bg-[#fafafa] border-[#e5e5e5]'
        }`}
      >
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-2.5">
          <span
            className={`font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono text-[11px] ${
              isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
            }`}
          >
            <Filter
              className={`w-3.5 h-3.5 ${isDark ? 'text-[#60a5fa]' : 'text-[#555555]'}`}
            />
            Filters:
          </span>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by Category"
            className={`px-2.5 py-1.5 sm:py-1 text-xs border rounded-none focus:outline-none transition-colors ${
              isDark
                ? 'bg-[#0f172a] text-[#f8fafc] border-[#334155] focus:border-[#60a5fa]'
                : 'bg-[#ffffff] text-[#111111] border-[#cccccc] focus:border-[#111111]'
            }`}
          >
            <option value="ALL">All Categories ({documents.length})</option>
            {ORDERED_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* System Dropdown */}
          {availableSystems.length > 0 && (
            <select
              value={selectedSystem}
              onChange={(e) => setSelectedSystem(e.target.value)}
              aria-label="Filter by System"
              className={`px-2.5 py-1.5 sm:py-1 text-xs border rounded-none focus:outline-none transition-colors ${
                isDark
                  ? 'bg-[#0f172a] text-[#f8fafc] border-[#334155] focus:border-[#60a5fa]'
                  : 'bg-[#ffffff] text-[#111111] border-[#cccccc] focus:border-[#111111]'
              }`}
            >
              <option value="ALL">All Systems</option>
              {availableSystems.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {/* In-table Quick Search */}
          <div className="relative flex-1 sm:flex-initial">
            <Search
              className={`w-3.5 h-3.5 absolute left-2.5 top-2.5 sm:top-2 pointer-events-none ${
                isDark ? 'text-[#64748b]' : 'text-[#777777]'
              }`}
            />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter title, order no, code..."
              className={`pl-8 pr-2.5 py-1.5 sm:py-1 text-xs w-full sm:w-56 border rounded-none focus:outline-none transition-colors ${
                isDark
                  ? 'bg-[#0f172a] text-[#f8fafc] placeholder-[#64748b] border-[#334155] focus:border-[#60a5fa]'
                  : 'bg-[#ffffff] text-[#111111] placeholder-[#888888] border-[#cccccc] focus:border-[#111111]'
              }`}
            />
          </div>

          {(selectedCategory !== 'ALL' || selectedSystem !== 'ALL' || searchFilter) && (
            <button
              onClick={() => {
                setSelectedCategory('ALL');
                setSelectedSystem('ALL');
                setSearchFilter('');
              }}
              className={`underline text-xs cursor-pointer ${
                isDark ? 'text-[#60a5fa] hover:text-[#93c5fd]' : 'text-[#555555] hover:text-[#111111]'
              }`}
            >
              Clear
            </button>
          )}
        </div>

        <div
          className={`flex items-center justify-between sm:justify-end space-x-3 text-xs pt-1 sm:pt-0 border-t sm:border-t-0 ${
            isDark ? 'text-[#94a3b8] border-[#243042]' : 'text-[#777777] border-[#e5e5e5]'
          }`}
        >
          <span>
            <strong>{filteredDocuments.length}</strong> / <strong>{documents.length}</strong> docs
          </span>
          <span>•</span>
          <label className="flex items-center space-x-1">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Items per page"
              className={`border px-1.5 py-0.5 text-xs rounded-none ${
                isDark
                  ? 'bg-[#0f172a] text-[#f8fafc] border-[#334155]'
                  : 'bg-[#ffffff] text-[#111111] border-[#cccccc]'
              }`}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>
      </div>

      {/* COMPACT SIEMENS-STYLE CATALOGUE TABLE (Scrollable container on mobile) */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse text-xs min-w-[720px]">
          <thead>
            <tr
              className={`font-semibold text-[11px] uppercase tracking-wider select-none ${
                isDark
                  ? 'bg-[#0f172a] text-[#f8fafc] border-b border-[#243042]'
                  : 'bg-[#111111] text-[#ffffff]'
              }`}
            >
              <th
                className={`py-2.5 px-3 border-r w-28 ${
                  isDark ? 'border-[#243042]' : 'border-[#333333]'
                }`}
              >
                <span>System</span>
              </th>
              <th
                className={`py-2.5 px-4 border-r ${
                  isDark ? 'border-[#243042]' : 'border-[#333333]'
                }`}
              >
                <span>Title</span>
              </th>
              <th
                className={`py-2.5 px-2.5 border-r w-16 text-center ${
                  isDark ? 'border-[#243042]' : 'border-[#333333]'
                }`}
              >
                <span>SW</span>
              </th>
              <th
                className={`py-2.5 px-2.5 border-r w-20 text-center ${
                  isDark ? 'border-[#243042]' : 'border-[#333333]'
                }`}
              >
                <span>Edition</span>
              </th>
              <th
                className={`py-2.5 px-3 border-r w-44 ${
                  isDark ? 'border-[#243042]' : 'border-[#333333]'
                }`}
              >
                <span>Order No.</span>
              </th>
              <th
                className={`py-2.5 px-3 border-r w-28 text-center ${
                  isDark ? 'border-[#243042]' : 'border-[#333333]'
                }`}
              >
                <span>File Name</span>
              </th>
              <th className="py-2.5 px-3 text-center w-32">
                <span>Availability</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {categoriesToRender.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className={`py-12 text-center ${
                    isDark ? 'bg-[#141c2b] text-[#94a3b8]' : 'bg-[#ffffff] text-[#777777]'
                  }`}
                >
                  <FileText
                    className={`w-8 h-8 mx-auto mb-2 ${
                      isDark ? 'text-[#334155]' : 'text-[#cccccc]'
                    }`}
                  />
                  <p
                    className={`font-semibold text-sm ${
                      isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                    }`}
                  >
                    No catalogue entries match the current filter.
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                    }`}
                  >
                    Try resetting the search or category filters.
                  </p>
                </td>
              </tr>
            ) : (
              categoriesToRender.map((category) => {
                const categoryDocs = filteredGrouped[category] || [];
                const isCollapsed = collapsedCategories[category];
                const currentPage = categoryPages[category] || 1;
                const totalCategoryPages = Math.ceil(categoryDocs.length / pageSize);
                const paginatedDocs = categoryDocs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

                return (
                  <React.Fragment key={category}>
                    {/* CATEGORY HEADING ROW (Siemens DOConCD Section Style) */}
                    <tr
                      onClick={() => toggleCategory(category)}
                      className={`border-y cursor-pointer select-none transition-colors ${
                        isDark
                          ? 'bg-[#111827] border-[#243042] hover:bg-[#162032]'
                          : 'bg-[#f5f5f5] border-[#e5e5e5] hover:bg-[#eaeaea]'
                      }`}
                    >
                      <td colSpan={7} className="py-2 px-3 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {isCollapsed ? (
                              <ChevronRight
                                className={`w-4 h-4 ${
                                  isDark ? 'text-[#60a5fa]' : 'text-[#555555]'
                                }`}
                              />
                            ) : (
                              <ChevronDown
                                className={`w-4 h-4 ${
                                  isDark ? 'text-[#60a5fa]' : 'text-[#555555]'
                                }`}
                              />
                            )}
                            <span
                              className={`uppercase tracking-wide font-bold ${
                                isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                              }`}
                            >
                              {category}
                            </span>
                            <span
                              className={`text-[11px] font-normal ${
                                isDark ? 'text-[#94a3b8]' : 'text-[#666666]'
                              }`}
                            >
                              ({categoryDocs.length} {categoryDocs.length === 1 ? 'document' : 'documents'})
                            </span>
                          </div>
                          <span
                            className={`text-[11px] font-mono hidden sm:inline ${
                              isDark ? 'text-[#64748b]' : 'text-[#777777]'
                            }`}
                          >
                            {isCollapsed ? 'Click to expand' : 'Click to collapse'}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* DOCUMENT ROWS */}
                    {!isCollapsed &&
                      paginatedDocs.map((doc, idx) => {
                        const isAvailable = doc.availabilityStatus === 'AVAILABLE' && Boolean(doc.secureUrl);

                        return (
                          <tr
                            key={doc._id || `${category}_${idx}`}
                            onClick={() => handleRowClick(doc)}
                            className={`border-b transition-colors cursor-pointer ${
                              isDark
                                ? idx % 2 === 1
                                  ? 'bg-[#141c2b] border-[#1e293b]'
                                  : 'bg-[#0f172a] border-[#1e293b]'
                                : idx % 2 === 1
                                ? 'bg-[#fafafa] border-[#e5e5e5]'
                                : 'bg-[#ffffff] border-[#e5e5e5]'
                            } ${isDark ? 'hover:bg-[#1e293b]' : 'hover:bg-[#f0f0f0]'}`}
                          >
                            {/* System */}
                            <td
                              className={`py-2 px-3 border-r font-mono text-[11px] whitespace-nowrap ${
                                isDark ? 'border-[#243042] text-[#f8fafc]' : 'border-[#e5e5e5] text-[#111111]'
                              }`}
                            >
                              <span
                                className={`border px-1.5 py-0.5 font-semibold text-[10px] ${
                                  isDark
                                    ? 'bg-[#1e293b] border-[#334155] text-[#f8fafc]'
                                    : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
                                }`}
                              >
                                {doc.system || '—'}
                              </span>
                            </td>

                            {/* Title (Clickable) */}
                            <td
                              className={`py-2 px-4 border-r ${
                                isDark ? 'border-[#243042] text-[#f8fafc]' : 'border-[#e5e5e5] text-[#111111]'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <FileText
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isAvailable
                                      ? isDark
                                        ? 'text-[#60a5fa]'
                                        : 'text-[#111111]'
                                      : isDark
                                      ? 'text-[#64748b]'
                                      : 'text-[#888888]'
                                  }`}
                                />
                                <span
                                  className={`font-medium ${
                                    isAvailable
                                      ? isDark
                                        ? 'text-[#f8fafc] hover:underline'
                                        : 'text-[#111111] hover:underline'
                                      : isDark
                                      ? 'text-[#94a3b8]'
                                      : 'text-[#555555]'
                                  } leading-tight`}
                                >
                                  {doc.title}
                                </span>
                              </div>
                            </td>

                            {/* SW Version */}
                            <td
                              className={`py-2 px-2.5 border-r text-center font-mono text-[11px] ${
                                isDark ? 'border-[#243042] text-[#94a3b8]' : 'border-[#e5e5e5] text-[#555555]'
                              }`}
                            >
                              {doc.softwareVersion || '—'}
                            </td>

                            {/* Edition */}
                            <td
                              className={`py-2 px-2.5 border-r text-center font-mono text-[11px] ${
                                isDark ? 'border-[#243042] text-[#94a3b8]' : 'border-[#e5e5e5] text-[#555555]'
                              }`}
                            >
                              {doc.edition || '—'}
                            </td>

                            {/* Order Number */}
                            <td
                              className={`py-2 px-3 border-r font-mono text-[11px] whitespace-nowrap ${
                                isDark ? 'border-[#243042] text-[#cbd5e1]' : 'border-[#e5e5e5] text-[#111111]'
                              }`}
                            >
                              {doc.orderNumber || '—'}
                            </td>

                            {/* File Name */}
                            <td
                              className={`py-2 px-3 border-r text-center font-mono font-bold text-[11px] ${
                                isDark ? 'border-[#243042] text-[#f8fafc]' : 'border-[#e5e5e5] text-[#111111]'
                              }`}
                            >
                              <span
                                className={`px-1.5 py-0.5 border ${
                                  isDark
                                    ? 'bg-[#1e293b] border-[#334155] text-[#60a5fa]'
                                    : 'bg-[#f0f0f0] border-[#cccccc] text-[#111111]'
                                }`}
                              >
                                {doc.fileName || doc.documentCode || '—'}
                              </span>
                            </td>

                            {/* Availability & Actions */}
                            <td
                              className="py-2 px-3 text-center whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-center space-x-1.5">
                                {isAvailable ? (
                                  <>
                                    <span
                                      className={`inline-flex items-center space-x-1 px-1.5 py-0.5 border font-mono text-[10px] font-semibold select-none ${
                                        isDark
                                          ? 'bg-[#064e3b] text-[#a7f3d0] border-[#047857]'
                                          : 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]'
                                      }`}
                                      title="Document is available and verified"
                                    >
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      <span>AVAILABLE</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => onSelectDocument && onSelectDocument(doc)}
                                      title="Open in Viewer"
                                      aria-label={`Open ${doc.title} in viewer`}
                                      className={`p-1 transition-colors cursor-pointer ml-1 ${
                                        isDark
                                          ? 'hover:bg-[#1e293b] text-[#f8fafc]'
                                          : 'hover:bg-[#e5e5e5] text-[#111111]'
                                      }`}
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    {userPermissions.download && (
                                      <button
                                        type="button"
                                        onClick={() => onDownloadDocument && onDownloadDocument(doc)}
                                        title="Download Manual"
                                        aria-label={`Download ${doc.title}`}
                                        className={`p-1 transition-colors cursor-pointer ${
                                          isDark
                                            ? 'hover:bg-[#1e293b] text-[#f8fafc]'
                                            : 'hover:bg-[#e5e5e5] text-[#111111]'
                                        }`}
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setUnavailableModalDoc(doc)}
                                    className={`inline-flex items-center space-x-1 px-1.5 py-0.5 border font-mono text-[10px] font-semibold cursor-pointer ${
                                      isDark
                                        ? 'bg-[#1e293b] text-[#94a3b8] border-[#334155] hover:bg-[#334155]'
                                        : 'bg-[#f5f5f5] text-[#777777] border-[#cccccc] hover:bg-[#eeeeee]'
                                    }`}
                                    title="Physical manual file not in repository"
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5 text-[#f59e0b]" />
                                    <span>FILE NOT AVAILABLE</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                    {/* Pagination for Category (if > pageSize) */}
                    {!isCollapsed && totalCategoryPages > 1 && (
                      <tr
                        className={`border-b ${
                          isDark ? 'bg-[#111827] border-[#243042]' : 'bg-[#ffffff] border-[#e5e5e5]'
                        }`}
                      >
                        <td
                          colSpan={7}
                          className={`py-2 px-4 text-xs ${
                            isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                            <span>
                              Page {currentPage} of {totalCategoryPages} in {category}
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              {Array.from({ length: totalCategoryPages }).map((_, pIdx) => (
                                <button
                                  key={pIdx + 1}
                                  type="button"
                                  onClick={() => handlePageChange(category, pIdx + 1)}
                                  className={`px-2 py-0.5 text-xs font-mono border cursor-pointer ${
                                    currentPage === pIdx + 1
                                      ? isDark
                                        ? 'bg-[#f8fafc] text-[#0b0f17] border-[#f8fafc]'
                                        : 'bg-[#111111] text-[#ffffff] border-[#111111]'
                                      : isDark
                                      ? 'bg-[#1e293b] text-[#cbd5e1] border-[#334155] hover:bg-[#334155]'
                                      : 'bg-[#ffffff] text-[#111111] border-[#cccccc] hover:bg-[#f5f5f5]'
                                  }`}
                                >
                                  {pIdx + 1}
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* DOConCD Table Footer */}
      <div
        className={`border-t p-2.5 px-4 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 ${
          isDark
            ? 'bg-[#111827] border-[#243042] text-[#94a3b8]'
            : 'bg-[#fafafa] border-[#e5e5e5] text-[#777777]'
        }`}
      >
        <div className="flex items-center space-x-4">
          <span className="font-mono text-[10px] sm:text-[11px] text-center sm:text-left">
            DOConCD 09/2011 Master Catalogue • Siemens SINUMERIK / SINAMICS
          </span>
        </div>
        <div
          className={`font-mono text-[11px] ${
            isDark ? 'text-[#cbd5e1]' : 'text-[#555555]'
          }`}
        >
          Total Catalogue Entries: <strong>{filteredDocuments.length}</strong>
        </div>
      </div>

      {/* Unavailable Document Info Modal */}
      {unavailableModalDoc && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className={`border max-w-md w-full p-4 sm:p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto ${
              isDark
                ? 'bg-[#141c2b] border-[#334155] text-[#f8fafc]'
                : 'bg-[#ffffff] border-[#111111] text-[#111111]'
            }`}
          >
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-[#f59e0b] shrink-0" />
              <h3 className="font-bold text-sm uppercase tracking-wide">
                Document File Not Available
              </h3>
            </div>
            <p
              className={`text-xs leading-relaxed ${
                isDark ? 'text-[#cbd5e1]' : 'text-[#555555]'
              }`}
            >
              This document is an authentic entry in the master Siemens DOConCD SINUMERIK / SINAMICS 09/2011 catalogue,
              but its physical document file is not present in the current archive.
            </p>
            <div
              className={`border p-3 text-xs space-y-1 font-mono ${
                isDark
                  ? 'bg-[#0f172a] border-[#243042] text-[#f8fafc]'
                  : 'bg-[#fafafa] border-[#e5e5e5] text-[#111111]'
              }`}
            >
              <div>
                <strong>Title:</strong> {unavailableModalDoc.title}
              </div>
              <div>
                <strong>System:</strong> {unavailableModalDoc.system || '—'}
              </div>
              <div>
                <strong>Order No:</strong> {unavailableModalDoc.orderNumber || '—'}
              </div>
              <div>
                <strong>File Name:</strong> {unavailableModalDoc.fileName}
              </div>
              <div>
                <strong>Category:</strong> {unavailableModalDoc.category}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setUnavailableModalDoc(null)}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider cursor-pointer ${
                  isDark
                    ? 'bg-[#f8fafc] text-[#0b0f17] hover:bg-[#e2e8f0]'
                    : 'bg-[#111111] text-[#ffffff] hover:bg-[#333333]'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
