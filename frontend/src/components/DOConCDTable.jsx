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
  ChevronsUpDown,
  Maximize2,
  Minimize2,
  Info,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import simodriveCatalogue from '../data/simodrive_catalogue_extracted.json';

// Exact Official Siemens SINUMERIK / SIMODRIVE 09/2011 Master Catalogue Hierarchy
export const SIMODRIVE_CATEGORY_ORDER = [
  '840D/840Di/810D User Operation',
  'Programming',
  'Manufacturer/Service',
  'Commissioning',
  'Functions',
  '802D base line',
  '802S/802C base line',
  'SIMODRIVE',
  'SIMODRIVE Sensor',
  'Synchronous motors',
  'Asynchronous motors',
  'Linear/Torque Motors',
  'Distributed drive technology',
  'Motion Control Information System',
  'SIMATIC Positioning Modules',
  'ePS Network Services',
  'SIMATIC',
  'Info/Training',
  'Control system overview',
];

// Legacy SINAMICS DOConCD Categories fallback
const SINAMICS_CATEGORY_ORDER = [
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
  isSimodrive = false,
}) {
  const { isDark } = useTheme();

  // Filters and Sorting States
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSystem, setSelectedSystem] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [sortBy, setSortBy] = useState('catalogue'); // 'catalogue' | 'system' | 'title' | 'orderNumber' | 'fileName'
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [unavailableModalDoc, setUnavailableModalDoc] = useState(null);

  // Determine if this is SIMODRIVE catalogue mode
  const isSimodriveMode = useMemo(() => {
    if (isSimodrive) return true;
    if (availableCategories.some((c) => SIMODRIVE_CATEGORY_ORDER.includes(c))) return true;
    if (documents.some((d) => d.category === '840D/840Di/810D User Operation' || d.category === 'SIMODRIVE Sensor')) {
      return true;
    }
    return true; // Default to official master catalogue
  }, [isSimodrive, availableCategories, documents]);

  const activeCategoryOrder = isSimodriveMode ? SIMODRIVE_CATEGORY_ORDER : SINAMICS_CATEGORY_ORDER;

  // Build the complete catalogue dataset matching live MongoDB documents
  const activeCatalogue = useMemo(() => {
    if (!isSimodriveMode) {
      return documents;
    }

    // Index live MongoDB documents by fileName and orderNumber
    const fnMap = new Map();
    const orderMap = new Map();

    documents.forEach((d) => {
      if (d.fileName) fnMap.set(d.fileName.trim().toLowerCase(), d);
      if (d.originalFileName) {
        const base = d.originalFileName.replace(/\.[^/.]+$/, '').trim().toLowerCase();
        if (!fnMap.has(base)) fnMap.set(base, d);
      }
      if (d.orderNumber && d.orderNumber.trim()) {
        orderMap.set(d.orderNumber.trim().toLowerCase(), d);
      }
    });

    return simodriveCatalogue.map((catEntry) => {
      const fn = (catEntry.fileName || '').trim().toLowerCase();
      const order = (catEntry.orderNumber || '').trim().toLowerCase();

      // Priority match: fileName -> orderNumber
      const matchedDoc = fnMap.get(fn) || (order ? orderMap.get(order) : null);
      const isAvailable = Boolean(matchedDoc && (matchedDoc.secureUrl || matchedDoc.availabilityStatus === 'AVAILABLE'));

      return {
        _id: matchedDoc?._id || `missing_${catEntry.fileName}`,
        catalogueIndex: catEntry.catalogueIndex,
        displayOrder: catEntry.catalogueIndex,
        page: catEntry.page,
        category: catEntry.category,
        system: catEntry.system || '—',
        title: catEntry.title || '—',
        softwareVersion: catEntry.softwareVersion || '—',
        edition: catEntry.edition || '—',
        orderNumber: catEntry.orderNumber || '—',
        fileName: catEntry.fileName || '—',
        status: isAvailable ? 'Available' : 'Missing',
        availabilityStatus: isAvailable ? 'AVAILABLE' : 'FILE_NOT_FOUND',
        secureUrl: matchedDoc?.secureUrl || null,
        originalFileName: matchedDoc?.originalFileName || `${catEntry.fileName}.pdf`,
        fileSize: matchedDoc?.fileSize || 0,
        mimeType: matchedDoc?.mimeType || 'application/pdf',
        fileExtension: matchedDoc?.fileExtension || 'pdf',
        storageProvider: matchedDoc?.storageProvider || 'CLOUDINARY',
        isCatalogueRecord: true,
        matchedDocId: matchedDoc?._id || null,
      };
    });
  }, [documents, isSimodriveMode]);

  // Distinct systems for filter dropdown
  const systemOptions = useMemo(() => {
    const set = new Set();
    activeCatalogue.forEach((doc) => {
      if (doc.system && doc.system !== '—') {
        set.add(doc.system);
      }
    });
    return Array.from(set).sort();
  }, [activeCatalogue]);

  // Expand / Collapse toggles
  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const expandAll = () => {
    setCollapsedCategories({});
  };

  const collapseAll = () => {
    const all = {};
    activeCategoryOrder.forEach((c) => {
      all[c] = true;
    });
    setCollapsedCategories(all);
  };

  // Filter documents based on Category, System, and Search Query
  const filteredDocuments = useMemo(() => {
    return activeCatalogue.filter((doc) => {
      if (selectedCategory !== 'ALL' && doc.category !== selectedCategory) {
        return false;
      }
      if (selectedSystem !== 'ALL' && doc.system !== selectedSystem) {
        return false;
      }
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase().trim();
        const matchesTitle = (doc.title || '').toLowerCase().includes(query);
        const matchesSystem = (doc.system || '').toLowerCase().includes(query);
        const matchesOrder = (doc.orderNumber || '').toLowerCase().includes(query);
        const matchesFile = (doc.fileName || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesSystem && !matchesOrder && !matchesFile) {
          return false;
        }
      }
      return true;
    });
  }, [activeCatalogue, selectedCategory, selectedSystem, searchFilter]);

  // Group filtered documents by Category and sort items within each category
  const filteredGrouped = useMemo(() => {
    const groups = {};

    filteredDocuments.forEach((doc) => {
      const cat = doc.category || 'General';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(doc);
    });

    // Sort items inside each category according to the selected sorting option
    Object.keys(groups).forEach((cat) => {
      if (sortBy === 'system') {
        groups[cat].sort((a, b) => {
          const valA = a.system === '—' ? 'zzz' : a.system || 'zzz';
          const valB = b.system === '—' ? 'zzz' : b.system || 'zzz';
          return valA.localeCompare(valB);
        });
      } else if (sortBy === 'title') {
        groups[cat].sort((a, b) => {
          const valA = a.title === '—' ? 'zzz' : a.title || 'zzz';
          const valB = b.title === '—' ? 'zzz' : b.title || 'zzz';
          return valA.localeCompare(valB);
        });
      } else if (sortBy === 'orderNumber') {
        groups[cat].sort((a, b) => {
          const valA = a.orderNumber === '—' ? 'zzz' : a.orderNumber || 'zzz';
          const valB = b.orderNumber === '—' ? 'zzz' : b.orderNumber || 'zzz';
          return valA.localeCompare(valB);
        });
      } else if (sortBy === 'fileName') {
        groups[cat].sort((a, b) => {
          const valA = a.fileName === '—' ? 'zzz' : a.fileName || 'zzz';
          const valB = b.fileName === '—' ? 'zzz' : b.fileName || 'zzz';
          return valA.localeCompare(valB);
        });
      } else {
        // Official Siemens Catalogue Order (DEFAULT)
        groups[cat].sort((a, b) => (a.catalogueIndex || a.displayOrder || 0) - (b.catalogueIndex || b.displayOrder || 0));
      }
    });

    return groups;
  }, [filteredDocuments, sortBy]);

  // Ordered list of categories to render
  const categoriesToRender = useMemo(() => {
    const presentKeys = Object.keys(filteredGrouped);
    return activeCategoryOrder.filter((cat) => presentKeys.includes(cat) && filteredGrouped[cat]?.length > 0);
  }, [filteredGrouped, activeCategoryOrder]);

  const handleRowClick = (doc) => {
    if (doc.status === 'Missing' || doc.availabilityStatus === 'FILE_NOT_FOUND' || !doc.secureUrl) {
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
      {/* Siemens-Style Control & Filter Toolbar */}
      <div
        className={`border-b p-3 flex flex-col md:flex-row flex-wrap items-stretch md:items-center justify-between gap-3 text-xs ${
          isDark ? 'bg-[#111827] border-[#243042]' : 'bg-[#fafafa] border-[#e5e5e5]'
        }`}
      >
        {/* Left Controls: Filter Dropdowns & Live Search */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-2.5">
          <span
            className={`font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono text-[11px] ${
              isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
            }`}
          >
            <Filter className={`w-3.5 h-3.5 ${isDark ? 'text-[#60a5fa]' : 'text-[#555555]'}`} />
            Filter:
          </span>

          {/* Category Dropdown Navigation */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by Category"
            className={`px-2.5 py-2 sm:py-1 min-h-[44px] sm:min-h-[36px] text-xs border rounded-none focus:outline-none transition-colors ${
              isDark
                ? 'bg-[#0f172a] text-[#f8fafc] border-[#334155] focus:border-[#60a5fa]'
                : 'bg-[#ffffff] text-[#111111] border-[#cccccc] focus:border-[#111111]'
            }`}
          >
            <option value="ALL">All Categories ({activeCatalogue.length})</option>
            {activeCategoryOrder.map((c) => {
              const count = activeCatalogue.filter((d) => d.category === c).length;
              return (
                <option key={c} value={c}>
                  {c} ({count})
                </option>
              );
            })}
          </select>

          {/* System Dropdown Filter */}
          {systemOptions.length > 0 && (
            <select
              value={selectedSystem}
              onChange={(e) => setSelectedSystem(e.target.value)}
              aria-label="Filter by System"
              className={`px-2.5 py-2 sm:py-1 min-h-[44px] sm:min-h-[36px] text-xs border rounded-none focus:outline-none transition-colors ${
                isDark
                  ? 'bg-[#0f172a] text-[#f8fafc] border-[#334155] focus:border-[#60a5fa]'
                  : 'bg-[#ffffff] text-[#111111] border-[#cccccc] focus:border-[#111111]'
              }`}
            >
              <option value="ALL">All Systems ({systemOptions.length})</option>
              {systemOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {/* Live Search: searches System, Title, Order No, and File name */}
          <div className="relative flex-1 sm:flex-initial">
            <Search
              className={`w-3.5 h-3.5 absolute left-2.5 top-3.5 sm:top-2.5 pointer-events-none ${
                isDark ? 'text-[#64748b]' : 'text-[#777777]'
              }`}
            />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search System, Title, Order No, File name..."
              className={`pl-8 pr-2.5 py-2 sm:py-1 min-h-[44px] sm:min-h-[36px] text-xs w-full sm:w-64 border rounded-none focus:outline-none transition-colors ${
                isDark
                  ? 'bg-[#0f172a] text-[#f8fafc] placeholder-[#64748b] border-[#334155] focus:border-[#60a5fa]'
                  : 'bg-[#ffffff] text-[#111111] placeholder-[#888888] border-[#cccccc] focus:border-[#111111]'
              }`}
            />
          </div>

          {(selectedCategory !== 'ALL' || selectedSystem !== 'ALL' || searchFilter) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('ALL');
                setSelectedSystem('ALL');
                setSearchFilter('');
              }}
              className={`underline text-xs cursor-pointer py-1 ${
                isDark ? 'text-[#60a5fa] hover:text-[#93c5fd]' : 'text-[#555555] hover:text-[#111111]'
              }`}
            >
              Clear
            </button>
          )}
        </div>

        {/* Right Controls: Sort Order & Expand/Collapse All */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--border-subtle)]">
          {/* Sorting Selector */}
          <div className="flex items-center space-x-1.5">
            <span
              className={`font-mono text-[11px] uppercase tracking-wider hidden sm:inline ${
                isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
              }`}
            >
              Order:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Ordering Options"
              className={`px-2 py-1 min-h-[44px] sm:min-h-[36px] text-xs font-medium border rounded-none focus:outline-none transition-colors ${
                isDark
                  ? 'bg-[#0f172a] text-[#f8fafc] border-[#334155] focus:border-[#60a5fa]'
                  : 'bg-[#ffffff] text-[#111111] border-[#cccccc] focus:border-[#111111]'
              }`}
            >
              <option value="catalogue">Official Siemens Catalogue Order (DEFAULT)</option>
              <option value="system">System</option>
              <option value="title">Title (A–Z)</option>
              <option value="orderNumber">Order No. (A–Z)</option>
              <option value="fileName">File name (A–Z)</option>
            </select>
          </div>

          {/* Expand / Collapse All buttons */}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={expandAll}
              title="Expand all categories"
              className={`px-2 py-1 min-h-[44px] sm:min-h-[36px] text-[11px] font-mono border cursor-pointer transition-colors ${
                isDark
                  ? 'bg-[#1e293b] border-[#334155] text-[#cbd5e1] hover:bg-[#334155]'
                  : 'bg-[#ffffff] border-[#cccccc] text-[#111111] hover:bg-[#f5f5f5]'
              }`}
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              title="Collapse all categories"
              className={`px-2 py-1 min-h-[44px] sm:min-h-[36px] text-[11px] font-mono border cursor-pointer transition-colors ${
                isDark
                  ? 'bg-[#1e293b] border-[#334155] text-[#cbd5e1] hover:bg-[#334155]'
                  : 'bg-[#ffffff] border-[#cccccc] text-[#111111] hover:bg-[#f5f5f5]'
              }`}
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stat Bar */}
      <div
        className={`px-3 py-1.5 border-b text-[11px] font-mono flex items-center justify-between ${
          isDark ? 'bg-[#0b0f17] border-[#243042] text-[#94a3b8]' : 'bg-[#f0f0f0] border-[#e5e5e5] text-[#666666]'
        }`}
      >
        <span>
          Showing <strong>{filteredDocuments.length}</strong> of <strong>{activeCatalogue.length}</strong> official
          catalogue records across <strong>{categoriesToRender.length}</strong> categories
        </span>
        <span className="hidden sm:inline">Continuous Full-View (No Pagination)</span>
      </div>

      {/* DESKTOP VIEW: EXACT 8-COLUMN SIEMENS CATALOGUE TABLE (>= md) */}
      <div className="hidden md:block overflow-x-auto w-full">
        <table className="w-full text-left border-collapse text-xs min-w-[880px]">
          <thead>
            <tr
              className={`font-semibold text-xs tracking-wide select-none ${
                isDark ? 'bg-[#0f172a] text-[#f8fafc] border-b border-[#243042]' : 'bg-[#111111] text-[#ffffff]'
              }`}
            >
              <th className={`py-2.5 px-3 border-r w-32 ${isDark ? 'border-[#243042]' : 'border-[#333333]'}`}>
                System
              </th>
              <th className={`py-2.5 px-4 border-r ${isDark ? 'border-[#243042]' : 'border-[#333333]'}`}>
                Title
              </th>
              <th
                className={`py-2.5 px-2.5 border-r w-20 text-center ${
                  isDark ? 'border-[#243042]' : 'border-[#333333]'
                }`}
              >
                SW
              </th>
              <th
                className={`py-2.5 px-2.5 border-r w-24 text-center ${
                  isDark ? 'border-[#243042]' : 'border-[#333333]'
                }`}
              >
                Edition
              </th>
              <th className={`py-2.5 px-3 border-r w-44 ${isDark ? 'border-[#243042]' : 'border-[#333333]'}`}>
                Order No.
              </th>
              <th
                className={`py-2.5 px-3 border-r w-32 text-center ${
                  isDark ? 'border-[#243042]' : 'border-[#333333]'
                }`}
              >
                File name
              </th>
              <th
                className={`py-2.5 px-3 border-r w-28 text-center ${
                  isDark ? 'border-[#243042]' : 'border-[#333333]'
                }`}
              >
                Status
              </th>
              <th className="py-2.5 px-3 text-center w-36">Actions</th>
            </tr>
          </thead>

          <tbody>
            {categoriesToRender.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className={`py-12 text-center ${
                    isDark ? 'bg-[#141c2b] text-[#94a3b8]' : 'bg-[#ffffff] text-[#777777]'
                  }`}
                >
                  <FileText
                    className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-[#334155]' : 'text-[#cccccc]'}`}
                  />
                  <p className={`font-semibold text-sm ${isDark ? 'text-[#f8fafc]' : 'text-[#111111]'}`}>
                    No catalogue entries match the current filter.
                  </p>
                  <p className="text-xs mt-1">Try resetting the search or category filters.</p>
                </td>
              </tr>
            ) : (
              categoriesToRender.map((category) => {
                const categoryDocs = filteredGrouped[category] || [];
                const isCollapsed = collapsedCategories[category];

                return (
                  <React.Fragment key={category}>
                    {/* CATEGORY HEADING ROW (Siemens DOConCD Section Banner) */}
                    <tr
                      data-cat-row="true"
                      data-category={category}
                      onClick={() => toggleCategory(category)}
                      className={`border-y cursor-pointer select-none transition-colors ${
                        isDark
                          ? 'bg-[#111827] border-[#243042] hover:bg-[#162032]'
                          : 'bg-[#f5f5f5] border-[#e5e5e5] hover:bg-[#eaeaea]'
                      }`}
                    >
                      <td colSpan={8} className="py-2.5 px-3 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {isCollapsed ? (
                              <ChevronRight
                                className={`w-4 h-4 shrink-0 ${isDark ? 'text-[#60a5fa]' : 'text-[#555555]'}`}
                              />
                            ) : (
                              <ChevronDown
                                className={`w-4 h-4 shrink-0 ${isDark ? 'text-[#60a5fa]' : 'text-[#555555]'}`}
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

                    {/* CONTINUOUS LIST OF DOCUMENT ROWS (NO PAGINATION) */}
                    {!isCollapsed &&
                      categoryDocs.map((doc, idx) => {
                        const isAvailable =
                          doc.status === 'Available' ||
                          (doc.availabilityStatus === 'AVAILABLE' && Boolean(doc.secureUrl));

                        return (
                          <tr
                            key={doc._id || `${category}_${idx}`}
                            data-doc-row="true"
                            data-doc-id={doc._id}
                            data-category={category}
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
                            {/* 1. System */}
                            <td
                              className={`py-2 px-3 border-r font-mono text-[11px] ${
                                isDark ? 'border-[#243042] text-[#f8fafc]' : 'border-[#e5e5e5] text-[#111111]'
                              }`}
                            >
                              {doc.system && doc.system !== '—' ? (
                                <span
                                  className={`border px-1.5 py-0.5 font-semibold text-[10px] inline-block max-w-[130px] truncate ${
                                    isDark
                                      ? 'bg-[#1e293b] border-[#334155] text-[#f8fafc]'
                                      : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
                                  }`}
                                  title={doc.system}
                                >
                                  {doc.system}
                                </span>
                              ) : (
                                <span className={isDark ? 'text-[#64748b]' : 'text-[#999999]'}>—</span>
                              )}
                            </td>

                            {/* 2. Title */}
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
                                  } leading-snug`}
                                >
                                  {doc.title && doc.title !== '—' ? doc.title : '—'}
                                </span>
                              </div>
                            </td>

                            {/* 3. SW (Software Version) */}
                            <td
                              className={`py-2 px-2.5 border-r text-center font-mono text-[11px] ${
                                isDark ? 'border-[#243042] text-[#94a3b8]' : 'border-[#e5e5e5] text-[#555555]'
                              }`}
                            >
                              {doc.softwareVersion && doc.softwareVersion !== '—' ? (
                                doc.softwareVersion
                              ) : (
                                <span className={isDark ? 'text-[#64748b]' : 'text-[#999999]'}>—</span>
                              )}
                            </td>

                            {/* 4. Edition */}
                            <td
                              className={`py-2 px-2.5 border-r text-center font-mono text-[11px] ${
                                isDark ? 'border-[#243042] text-[#94a3b8]' : 'border-[#e5e5e5] text-[#555555]'
                              }`}
                            >
                              {doc.edition && doc.edition !== '—' ? (
                                doc.edition
                              ) : (
                                <span className={isDark ? 'text-[#64748b]' : 'text-[#999999]'}>—</span>
                              )}
                            </td>

                            {/* 5. Order No. */}
                            <td
                              className={`py-2 px-3 border-r font-mono text-[11px] whitespace-nowrap ${
                                isDark ? 'border-[#243042] text-[#cbd5e1]' : 'border-[#e5e5e5] text-[#111111]'
                              }`}
                            >
                              {doc.orderNumber && doc.orderNumber !== '—' ? (
                                doc.orderNumber
                              ) : (
                                <span className={isDark ? 'text-[#64748b]' : 'text-[#999999]'}>—</span>
                              )}
                            </td>

                            {/* 6. File name */}
                            <td
                              className={`py-2 px-3 border-r text-center font-mono font-bold text-[11px] ${
                                isDark ? 'border-[#243042] text-[#f8fafc]' : 'border-[#e5e5e5] text-[#111111]'
                              }`}
                            >
                              {doc.fileName && doc.fileName !== '—' ? (
                                <span
                                  className={`px-1.5 py-0.5 border ${
                                    isDark
                                      ? 'bg-[#1e293b] border-[#334155] text-[#60a5fa]'
                                      : 'bg-[#f0f0f0] border-[#cccccc] text-[#111111]'
                                  }`}
                                >
                                  {doc.fileName}
                                </span>
                              ) : (
                                <span className={isDark ? 'text-[#64748b]' : 'text-[#999999]'}>—</span>
                              )}
                            </td>

                            {/* 7. Status */}
                            <td
                              className={`py-2 px-3 border-r text-center whitespace-nowrap ${
                                isDark ? 'border-[#243042]' : 'border-[#e5e5e5]'
                              }`}
                            >
                              {isAvailable ? (
                                <span
                                  className={`inline-flex items-center space-x-1 px-2 py-0.5 border font-mono text-[10px] font-semibold select-none ${
                                    isDark
                                      ? 'bg-[#064e3b] text-[#a7f3d0] border-[#047857]'
                                      : 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]'
                                  }`}
                                  title="Document file is stored and available in the archive"
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>Available</span>
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center space-x-1 px-2 py-0.5 border font-mono text-[10px] font-semibold select-none ${
                                    isDark
                                      ? 'bg-[#291e14] text-[#fcd34d] border-[#b45309]'
                                      : 'bg-[#fffbeb] text-[#b45309] border-[#fef3c7]'
                                  }`}
                                  title="Document file missing from physical archive"
                                >
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                                  <span>Missing</span>
                                </span>
                              )}
                            </td>

                            {/* 8. Actions (Preview and Download) */}
                            <td
                              className="py-2 px-3 text-center whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-center space-x-1.5">
                                {isAvailable ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => onSelectDocument && onSelectDocument(doc)}
                                      title="Preview Document"
                                      aria-label={`Preview ${doc.title}`}
                                      className={`px-2 py-1 border text-[11px] font-medium flex items-center space-x-1 cursor-pointer transition-colors ${
                                        isDark
                                          ? 'border-[#334155] text-[#f8fafc] bg-[#1e293b] hover:bg-[#334155]'
                                          : 'border-[#cccccc] text-[#111111] bg-[#ffffff] hover:bg-[#f0f0f0]'
                                      }`}
                                    >
                                      <Eye className="w-3.5 h-3.5 text-sky-400" />
                                      <span>Preview</span>
                                    </button>

                                    {userPermissions.download !== false && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onDownloadDocument
                                            ? onDownloadDocument(doc)
                                            : window.open(doc.secureUrl, '_blank')
                                        }
                                        title="Download Manual"
                                        aria-label={`Download ${doc.title}`}
                                        className={`px-2 py-1 border text-[11px] font-medium flex items-center space-x-1 cursor-pointer transition-colors ${
                                          isDark
                                            ? 'border-[#334155] text-[#cbd5e1] hover:bg-[#1e293b] hover:text-[#f8fafc]'
                                            : 'border-[#cccccc] text-[#555555] hover:bg-[#f5f5f5] hover:text-[#111111]'
                                        }`}
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Download</span>
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setUnavailableModalDoc(doc)}
                                    className={`px-2 py-1 border text-[11px] font-mono flex items-center space-x-1 cursor-pointer transition-colors ${
                                      isDark
                                        ? 'bg-[#1e293b] text-[#94a3b8] border-[#334155] hover:bg-[#334155]'
                                        : 'bg-[#f5f5f5] text-[#777777] border-[#cccccc] hover:bg-[#eeeeee]'
                                    }`}
                                    title="Physical manual file not in repository"
                                  >
                                    <Info className="w-3 h-3 text-amber-500" />
                                    <span>Details</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE VIEW (< md): STRUCTURED CARDS WITH TOUCH TARGETS >= 44PX */}
      <div className="block md:hidden p-2.5 space-y-3">
        {categoriesToRender.length === 0 ? (
          <div className={`p-8 text-center ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}>
            <FileText className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-[#334155]' : 'text-[#cccccc]'}`} />
            <p className={`font-semibold text-sm ${isDark ? 'text-[#f8fafc]' : 'text-[#111111]'}`}>
              No catalogue entries match the current filter.
            </p>
            <p className="text-xs mt-1">Try resetting the search or category filters.</p>
          </div>
        ) : (
          categoriesToRender.map((category) => {
            const categoryDocs = filteredGrouped[category] || [];
            const isCollapsed = collapsedCategories[category];

            return (
              <div
                key={`mob_cat_${category}`}
                className={`border ${
                  isDark ? 'border-[#243042] bg-[#0f172a]' : 'border-[#e5e5e5] bg-[#ffffff]'
                }`}
              >
                {/* Mobile Category Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className={`w-full p-3 min-h-[44px] flex items-center justify-between text-left transition-colors cursor-pointer ${
                    isDark ? 'bg-[#111827] hover:bg-[#162032]' : 'bg-[#f5f5f5] hover:bg-[#eaeaea]'
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0 pr-2">
                    {isCollapsed ? (
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 ${isDark ? 'text-[#60a5fa]' : 'text-[#555555]'}`}
                      />
                    ) : (
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 ${isDark ? 'text-[#60a5fa]' : 'text-[#555555]'}`}
                      />
                    )}
                    <div className="min-w-0">
                      <div
                        className={`text-xs font-bold uppercase tracking-wide truncate ${
                          isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                        }`}
                      >
                        {category}
                      </div>
                      <div className={`text-[10px] font-mono ${isDark ? 'text-[#94a3b8]' : 'text-[#666666]'}`}>
                        {categoryDocs.length} {categoryDocs.length === 1 ? 'doc' : 'docs'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 border shrink-0 ${
                      isDark ? 'border-[#334155] text-[#94a3b8]' : 'border-[#cccccc] text-[#666666]'
                    }`}
                  >
                    {isCollapsed ? 'EXPAND' : 'COLLAPSE'}
                  </span>
                </button>

                {/* Mobile Document Cards List (Continuous List, No Pagination) */}
                {!isCollapsed && (
                  <div className={`divide-y ${isDark ? 'divide-[#1e293b]' : 'divide-[#e5e5e5]'}`}>
                    {categoryDocs.map((doc, idx) => {
                      const isAvailable =
                        doc.status === 'Available' ||
                        (doc.availabilityStatus === 'AVAILABLE' && Boolean(doc.secureUrl));

                      return (
                        <div
                          key={`mob_doc_${doc._id || idx}`}
                          className={`p-3 space-y-2.5 transition-colors ${
                            idx % 2 === 1
                              ? isDark
                                ? 'bg-[#141c2b]'
                                : 'bg-[#fafafa]'
                              : isDark
                              ? 'bg-[#0f172a]'
                              : 'bg-[#ffffff]'
                          }`}
                        >
                          {/* Badges: System, SW, Edition, Status */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                            <span
                              className={`border px-1.5 py-0.5 font-semibold ${
                                isDark
                                  ? 'bg-[#1e293b] border-[#334155] text-[#f8fafc]'
                                  : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
                              }`}
                            >
                              {doc.system && doc.system !== '—' ? doc.system : '—'}
                            </span>
                            {doc.softwareVersion && doc.softwareVersion !== '—' && (
                              <span
                                className={`border px-1.5 py-0.5 ${
                                  isDark
                                    ? 'bg-[#111827] border-[#243042] text-[#94a3b8]'
                                    : 'bg-[#f0f0f0] border-[#dddddd] text-[#666666]'
                                }`}
                              >
                                SW {doc.softwareVersion}
                              </span>
                            )}
                            {doc.edition && doc.edition !== '—' && (
                              <span
                                className={`border px-1.5 py-0.5 ${
                                  isDark
                                    ? 'bg-[#111827] border-[#243042] text-[#94a3b8]'
                                    : 'bg-[#f0f0f0] border-[#dddddd] text-[#666666]'
                                }`}
                              >
                                Ed: {doc.edition}
                              </span>
                            )}
                            <span
                              className={`ml-auto border px-1.5 py-0.5 font-semibold text-[9px] ${
                                isAvailable
                                  ? isDark
                                    ? 'bg-[#064e3b] text-[#6ee7b7] border-[#047857]'
                                    : 'bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]'
                                  : isDark
                                  ? 'bg-[#291e14] text-[#fcd34d] border-[#b45309]'
                                  : 'bg-[#fffbeb] text-[#b45309] border-[#fef3c7]'
                              }`}
                            >
                              {isAvailable ? 'Available' : 'Missing'}
                            </span>
                          </div>

                          {/* Document Title */}
                          <div
                            onClick={() => handleRowClick(doc)}
                            className="cursor-pointer group"
                          >
                            <h4
                              className={`text-xs font-semibold leading-snug break-words ${
                                isAvailable
                                  ? isDark
                                    ? 'text-[#f8fafc] group-hover:text-[#60a5fa]'
                                    : 'text-[#111111] group-hover:underline'
                                  : isDark
                                  ? 'text-[#94a3b8]'
                                  : 'text-[#777777]'
                              }`}
                            >
                              {doc.title && doc.title !== '—' ? doc.title : '—'}
                            </h4>
                          </div>

                          {/* Order No & File Name */}
                          <div
                            className={`flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono ${
                              isDark ? 'text-[#94a3b8]' : 'text-[#666666]'
                            }`}
                          >
                            <div className="truncate">
                              <span className="opacity-70">Order No.:</span>{' '}
                              <span className="font-semibold">{doc.orderNumber || '—'}</span>
                            </div>
                            <div className="truncate">
                              <span className="opacity-70">File name:</span>{' '}
                              <span
                                className={`px-1 font-bold ${
                                  isDark ? 'text-[#60a5fa]' : 'text-[#111111]'
                                }`}
                              >
                                {doc.fileName || '—'}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons: strictly at least 44px high */}
                          <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-subtle)]">
                            {isAvailable ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onSelectDocument && onSelectDocument(doc)}
                                  className={`flex-1 min-h-[44px] px-3 py-2 text-xs font-semibold flex items-center justify-center space-x-1.5 border cursor-pointer transition-colors ${
                                    isDark
                                      ? 'bg-[#1e293b] hover:bg-[#334155] border-[#334155] text-[#f8fafc]'
                                      : 'bg-[#fafafa] hover:bg-[#f0f0f0] border-[#cccccc] text-[#111111]'
                                  }`}
                                >
                                  <Eye className="w-4 h-4 text-[#60a5fa]" />
                                  <span>Preview</span>
                                </button>
                                {userPermissions?.download !== false && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onDownloadDocument
                                        ? onDownloadDocument(doc)
                                        : window.open(doc.secureUrl, '_blank')
                                    }
                                    className={`flex-1 min-h-[44px] px-3 py-2 text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer transition-colors ${
                                      isDark
                                        ? 'bg-[#f8fafc] hover:bg-[#e2e8f0] text-[#0b0f17]'
                                        : 'bg-[#111111] hover:bg-[#333333] text-[#ffffff]'
                                    }`}
                                  >
                                    <Download className="w-4 h-4" />
                                    <span>Download</span>
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setUnavailableModalDoc(doc)}
                                className={`w-full min-h-[44px] px-3 py-2 text-xs flex items-center justify-center space-x-1.5 border cursor-pointer ${
                                  isDark
                                    ? 'border-[#334155] text-[#94a3b8] bg-[#111827]'
                                    : 'border-[#cccccc] text-[#666666] bg-[#f9f9f9]'
                                }`}
                              >
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <span>Document Missing from Archive</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* DOConCD Table Footer */}
      <div
        className={`border-t p-2.5 px-4 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 ${
          isDark ? 'bg-[#111827] border-[#243042] text-[#94a3b8]' : 'bg-[#fafafa] border-[#e5e5e5] text-[#777777]'
        }`}
      >
        <div className="flex items-center space-x-4">
          <span className="font-mono text-[10px] sm:text-[11px] text-center sm:text-left">
            DOConCD 09/2011 Master Catalogue • Siemens SINUMERIK / SIMODRIVE Reference
          </span>
        </div>
        <div className={`font-mono text-[11px] ${isDark ? 'text-[#cbd5e1]' : 'text-[#555555]'}`}>
          Total Catalogue Entries: <strong>{filteredDocuments.length}</strong> / <strong>{activeCatalogue.length}</strong>
        </div>
      </div>

      {/* Unavailable / Missing Document Info Modal */}
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
                Document Missing from Archive
              </h3>
            </div>
            <p
              className={`text-xs leading-relaxed ${
                isDark ? 'text-[#cbd5e1]' : 'text-[#555555]'
              }`}
            >
              This document is an authentic entry in the official Siemens DOConCD SINUMERIK / SIMODRIVE 09/2011 catalogue,
              but its physical document file is currently not uploaded to this DMS archive.
            </p>
            <div
              className={`border p-3 text-xs space-y-1 font-mono ${
                isDark
                  ? 'bg-[#0f172a] border-[#243042] text-[#f8fafc]'
                  : 'bg-[#fafafa] border-[#e5e5e5] text-[#111111]'
              }`}
            >
              <div>
                <strong>Title:</strong> {unavailableModalDoc.title && unavailableModalDoc.title !== '—' ? unavailableModalDoc.title : '—'}
              </div>
              <div>
                <strong>System:</strong> {unavailableModalDoc.system && unavailableModalDoc.system !== '—' ? unavailableModalDoc.system : '—'}
              </div>
              <div>
                <strong>SW:</strong> {unavailableModalDoc.softwareVersion && unavailableModalDoc.softwareVersion !== '—' ? unavailableModalDoc.softwareVersion : '—'}
              </div>
              <div>
                <strong>Edition:</strong> {unavailableModalDoc.edition && unavailableModalDoc.edition !== '—' ? unavailableModalDoc.edition : '—'}
              </div>
              <div>
                <strong>Order No.:</strong> {unavailableModalDoc.orderNumber && unavailableModalDoc.orderNumber !== '—' ? unavailableModalDoc.orderNumber : '—'}
              </div>
              <div>
                <strong>File name:</strong> {unavailableModalDoc.fileName && unavailableModalDoc.fileName !== '—' ? unavailableModalDoc.fileName : '—'}
              </div>
              <div>
                <strong>Category:</strong> {unavailableModalDoc.category}
              </div>
              <div>
                <strong>Status:</strong> Missing
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setUnavailableModalDoc(null)}
                className={`px-4 py-2 min-h-[44px] text-xs font-semibold uppercase tracking-wider cursor-pointer ${
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
