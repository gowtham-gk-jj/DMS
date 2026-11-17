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
  X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import simodriveCatalogue from '../data/simodrive_catalogue_extracted.json';
import sinamicsCatalogue from '../data/sinamics_catalogue_extracted.json';

// Exact Official Siemens SINUMERIK / SIMODRIVE 09/2011 Master Catalogue Hierarchy (19 categories)
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

// Exact Official Siemens SINUMERIK / SINAMICS 09/2011 Master Catalogue Hierarchy (19 categories)
export const SINAMICS_CATEGORY_ORDER = [
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

// Normalization helper for resilient multi-priority filename matching
const normalizeFileName = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[_\-\s]/g, '')
    .trim();
};

// Normalization helper for Siemens order numbers
const normalizeOrderNumber = (str) => {
  if (!str || str === '—' || str === '-') return '';
  return str.toLowerCase().replace(/[\s\-_]/g, '').trim();
};

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

  // Determine catalogue mode: explicit boolean prop takes absolute priority
  const isSimodriveMode = useMemo(() => {
    // 1. Explicit boolean prop takes absolute precedence
    if (typeof isSimodrive === 'boolean') {
      return isSimodrive;
    }

    // 2. Fallback check for exclusive SIMODRIVE categories (never check overlapping ones like Functions, SIMATIC, etc.)
    const exclusiveSimodriveCategories = [
      '840D/840Di/810D User Operation',
      '802D base line',
      '802S/802C base line',
      'SIMODRIVE',
      'SIMODRIVE Sensor',
      'Distributed drive technology',
      'SIMATIC Positioning Modules',
    ];
    if (availableCategories.some((c) => exclusiveSimodriveCategories.includes(c))) {
      return true;
    }
    if (documents.some((d) => exclusiveSimodriveCategories.includes(d.category))) {
      return true;
    }

    // 3. Fallback check for exclusive SINAMICS categories
    const exclusiveSinamicsCategories = [
      '840D sl/840Di sl/828D User / Operation',
      '840D sl/840Di sl/828D User / Programming',
      '840D sl/840Di sl Manufacturer/Service / Configuring',
      '840D sl/840Di sl Manufacturer/Service / Commissioning',
      '828D Manufacturer/Service / Version 4.3',
      '828D Manufacturer/Service / Version 2.6',
      '802D sl / User',
      '802D sl / Manufacturer/Service',
      'SINAMICS S120',
      'Measuring Systems',
    ];
    if (availableCategories.some((c) => exclusiveSinamicsCategories.includes(c))) {
      return false;
    }
    if (documents.some((d) => exclusiveSinamicsCategories.includes(d.category))) {
      return false;
    }

    // 4. Default to official primary catalogue: SINAMICS
    return false;
  }, [isSimodrive, availableCategories, documents]);

  const activeCategoryOrder = isSimodriveMode ? SIMODRIVE_CATEGORY_ORDER : SINAMICS_CATEGORY_ORDER;

  // Build the complete catalogue dataset matching live MongoDB documents
  const activeCatalogue = useMemo(() => {
    const targetCatalogue = isSimodriveMode ? simodriveCatalogue : sinamicsCatalogue;

    // Index live MongoDB documents by Priority:
    // 1. Existing Document ID or catalogueIndex
    // 2. Exact fileName or originalFileName
    // 3. Normalized fileName
    // 4. Siemens order number
    // 5. Verified title & system combination
    const idMap = new Map();
    const exactFnMap = new Map();
    const normalizedFnMap = new Map();
    const orderMap = new Map();
    const titleSystemMap = new Map();

    documents.forEach((d) => {
      if (d._id) idMap.set(String(d._id), d);
      if (d.catalogueIndex) idMap.set(`cat_${d.catalogueIndex}`, d);

      if (d.fileName) {
        exactFnMap.set(d.fileName.trim().toLowerCase(), d);
        const norm = normalizeFileName(d.fileName);
        if (norm && !normalizedFnMap.has(norm)) normalizedFnMap.set(norm, d);
      }
      if (d.originalFileName) {
        exactFnMap.set(d.originalFileName.trim().toLowerCase(), d);
        const base = d.originalFileName.replace(/\.[^/.]+$/, '').trim().toLowerCase();
        if (!exactFnMap.has(base)) exactFnMap.set(base, d);
        const norm = normalizeFileName(d.originalFileName);
        if (norm && !normalizedFnMap.has(norm)) normalizedFnMap.set(norm, d);
      }
      if (d.orderNumber && d.orderNumber.trim()) {
        const normOrder = normalizeOrderNumber(d.orderNumber);
        if (normOrder && !orderMap.has(normOrder)) {
          orderMap.set(normOrder, d);
        }
      }
      if (d.title && d.title !== '—' && d.system && d.system !== '—') {
        const titleSysKey = `${d.system.trim().toLowerCase()}__${d.title.trim().toLowerCase()}`;
        if (!titleSystemMap.has(titleSysKey)) {
          titleSystemMap.set(titleSysKey, d);
        }
      }
    });

    return targetCatalogue.map((catEntry) => {
      const rawFn = (catEntry.fileName || '').trim().toLowerCase();
      const normFn = normalizeFileName(catEntry.fileName);
      const normOrder = normalizeOrderNumber(catEntry.orderNumber);
      const titleSysKey = (catEntry.title && catEntry.title !== '—' && catEntry.system && catEntry.system !== '—')
        ? `${catEntry.system.trim().toLowerCase()}__${catEntry.title.trim().toLowerCase()}`
        : null;

      // Multi-Priority Match Execution:
      // 1. Existing Document ID or explicit catalogue index
      // 2. Exact fileName or originalFileName
      // 3. Normalized filename (case, extension, underscore/hyphen flexible)
      // 4. Siemens order number
      // 5. Verified title and system combination
      let matchedDoc = null;
      if (catEntry._id && idMap.has(String(catEntry._id))) {
        matchedDoc = idMap.get(String(catEntry._id));
      } else if (idMap.has(`cat_${catEntry.catalogueIndex}`)) {
        matchedDoc = idMap.get(`cat_${catEntry.catalogueIndex}`);
      } else if (rawFn && exactFnMap.has(rawFn)) {
        matchedDoc = exactFnMap.get(rawFn);
      } else if (normFn && normalizedFnMap.has(normFn)) {
        matchedDoc = normalizedFnMap.get(normFn);
      } else if (normOrder && orderMap.has(normOrder)) {
        matchedDoc = orderMap.get(normOrder);
      } else if (titleSysKey && titleSystemMap.has(titleSysKey)) {
        matchedDoc = titleSystemMap.get(titleSysKey);
      }

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
    <div className="w-full dms-card overflow-hidden">
      {/* Siemens-Style Control & Filter Toolbar */}
      <div className="border-b border-[var(--border-color)] p-3.5 sm:p-4 flex flex-col md:flex-row flex-wrap items-stretch md:items-center justify-between gap-3 text-xs bg-[var(--bg-elevated)]">
        {/* Left Controls: Filter Dropdowns & Live Search */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
          <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-secondary)]">
            <Filter className="w-3.5 h-3.5 text-[var(--primary-blue)]" />
            Filter:
          </span>

          {/* Category Dropdown Navigation */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by Category"
            className="px-3 py-1.5 min-h-[38px] text-xs rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary-blue)] transition-colors"
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
              className="px-3 py-1.5 min-h-[38px] text-xs rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary-blue)] transition-colors"
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
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search System, Title, Order No, File..."
              className="pl-9 pr-3 py-1.5 min-h-[38px] text-xs w-full sm:w-64 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary-blue)] transition-colors"
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
              className="text-xs text-[var(--primary-blue)] hover:underline cursor-pointer py-1 font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Right Controls: Sort Order & Expand/Collapse All */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--border-subtle)]">
          {/* Sorting Selector */}
          <div className="flex items-center space-x-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider hidden sm:inline text-[var(--text-muted)]">
              Order:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Ordering Options"
              className="px-2.5 py-1.5 min-h-[38px] text-xs font-medium rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary-blue)] transition-colors"
            >
              <option value="catalogue">Official Siemens Catalogue Order (DEFAULT)</option>
              <option value="system">System</option>
              <option value="title">Title (A–Z)</option>
              <option value="orderNumber">Order No. (A–Z)</option>
              <option value="fileName">File name (A–Z)</option>
            </select>
          </div>

          {/* Expand / Collapse All buttons */}
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={expandAll}
              title="Expand all categories"
              className="dms-btn-secondary px-2.5 py-1 min-h-[36px] text-[11px] font-mono"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              title="Collapse all categories"
              className="dms-btn-secondary px-2.5 py-1 min-h-[36px] text-[11px] font-mono"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stat Bar */}
      <div className="px-4 py-2 border-b border-[var(--border-subtle)] text-[11px] font-mono flex items-center justify-between bg-[var(--bg-main)] text-[var(--text-muted)]">
        <span>
          Showing <strong className="text-[var(--text-primary)]">{filteredDocuments.length}</strong> of{' '}
          <strong className="text-[var(--text-primary)]">{activeCatalogue.length}</strong> official catalogue records across{' '}
          <strong className="text-[var(--text-primary)]">{categoriesToRender.length}</strong> categories
        </span>
        <span className="hidden sm:inline">Continuous Full-View (No Pagination)</span>
      </div>

      {/* DESKTOP VIEW: EXACT 8-COLUMN SIEMENS CATALOGUE TABLE (>= md) */}
      <div className="hidden md:block overflow-x-auto w-full">
        <table className="w-full text-left border-collapse text-xs min-w-[880px]">
          <thead>
            <tr className="font-semibold text-xs tracking-wider select-none bg-[var(--table-header-bg)] text-[var(--table-header-text)] border-b border-[#29364A]">
              <th className="py-2.5 px-3 border-r border-[#29364A] w-32 font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
                System
              </th>
              <th className="py-2.5 px-4 border-r border-[#29364A] text-[11px] font-semibold text-[var(--text-secondary)]">
                Title
              </th>
              <th className="py-2.5 px-2.5 border-r border-[#29364A] w-20 text-center font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
                SW
              </th>
              <th className="py-2.5 px-2.5 border-r border-[#29364A] w-24 text-center font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
                Edition
              </th>
              <th className="py-2.5 px-3 border-r border-[#29364A] w-44 font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
                Order No.
              </th>
              <th className="py-2.5 px-3 border-r border-[#29364A] w-32 text-center font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
                File name
              </th>
              <th className="py-2.5 px-3 border-r border-[#29364A] w-28 text-center font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
                Status
              </th>
              <th className="py-2.5 px-3 text-center w-36 text-[11px] font-semibold text-[var(--text-secondary)]">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {categoriesToRender.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center bg-[var(--bg-card)] text-[var(--text-secondary)]">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)]" />
                  <p className="font-semibold text-sm text-[var(--text-primary)]">
                    No catalogue entries match the current filter.
                  </p>
                  <p className="text-xs mt-1 text-[var(--text-muted)]">Try resetting the search or category filters.</p>
                </td>
              </tr>
            ) : (
              categoriesToRender.map((category, catIdx) => {
                const categoryDocs = filteredGrouped[category] || [];
                const isCollapsed = collapsedCategories[category];
                const isPrimary = catIdx % 2 === 0;

                return (
                  <React.Fragment key={category}>
                    {/* CATEGORY HEADING ROW (Siemens DOConCD Section Banner: Alternating Warm Orange #F59E0B / Light Orange #FDBA74) */}
                    <tr
                      data-cat-row="true"
                      data-category={category}
                      data-category-index={catIdx}
                      data-band-type={isPrimary ? 'primary' : 'secondary'}
                      onClick={() => toggleCategory(category)}
                      className={`cursor-pointer select-none transition-colors border-y border-[#29364A] ${
                        isPrimary
                          ? 'bg-[#F59E0B] hover:bg-[#EAA00A] text-[#292016]'
                          : 'bg-[#FDBA74] hover:bg-[#FBA859] text-[#292016]'
                      }`}
                    >
                      <td colSpan={8} className="py-2.5 px-4 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2.5">
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 shrink-0 text-[#292016]" />
                            ) : (
                              <ChevronDown className="w-4 h-4 shrink-0 text-[#292016]" />
                            )}
                            <span className="uppercase tracking-wider font-bold text-xs sm:text-[13px] font-mono text-[#292016]">
                              {category}
                            </span>
                            <span className="text-[11px] font-mono font-semibold text-[#292016]/80 px-2 py-0.5 rounded-full bg-[#292016]/10">
                              {categoryDocs.length} {categoryDocs.length === 1 ? 'document' : 'documents'}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono font-semibold text-[#292016]/80 hidden sm:inline">
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
                            className={`border-b border-[#29364A] transition-colors cursor-pointer ${
                              idx % 2 === 1 ? 'bg-[#141C2B]' : 'bg-[#101827]'
                            } hover:bg-[#1E2B3E]`}
                          >
                            {/* 1. System */}
                            <td className="py-2.5 px-3 border-r border-[#29364A] font-mono text-[11px] text-[#F1F5F9]">
                              {doc.system && doc.system !== '—' ? (
                                <span
                                  className="border border-[#29364A] px-2 py-0.5 rounded font-mono font-semibold text-[10px] inline-block max-w-[130px] truncate bg-[#172235] text-[#F1F5F9]"
                                  title={doc.system}
                                >
                                  {doc.system}
                                </span>
                              ) : (
                                <span className="text-[var(--text-muted)] font-mono">—</span>
                              )}
                            </td>

                            {/* 2. Title */}
                            <td className="py-2.5 px-4 border-r border-[#29364A] text-[#F1F5F9]">
                              <div className="flex items-start space-x-2.5 py-0.5">
                                <FileText
                                  className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                    isAvailable ? 'text-[#60A5FA]' : 'text-[var(--text-muted)]'
                                  }`}
                                />
                                <span
                                  className={`font-medium ${
                                    isAvailable
                                      ? 'text-[#F1F5F9] hover:text-[#60A5FA]'
                                      : 'text-[#94A3B8]'
                                  } leading-snug break-words`}
                                >
                                  {doc.title && doc.title !== '—' ? doc.title : '—'}
                                </span>
                              </div>
                            </td>

                            {/* 3. SW (Software Version) */}
                            <td className="py-2.5 px-2.5 border-r border-[#29364A] text-center font-mono text-[11px] text-[#94A3B8]">
                              {doc.softwareVersion && doc.softwareVersion !== '—' ? (
                                <span className="font-mono">{doc.softwareVersion}</span>
                              ) : (
                                <span className="text-[var(--text-muted)] font-mono">—</span>
                              )}
                            </td>

                            {/* 4. Edition */}
                            <td className="py-2.5 px-2.5 border-r border-[#29364A] text-center font-mono text-[11px] text-[#94A3B8]">
                              {doc.edition && doc.edition !== '—' ? (
                                <span className="font-mono">{doc.edition}</span>
                              ) : (
                                <span className="text-[var(--text-muted)] font-mono">—</span>
                              )}
                            </td>

                            {/* 5. Order No. */}
                            <td className="py-2.5 px-3 border-r border-[#29364A] font-mono text-[11px] whitespace-nowrap text-[#94A3B8]">
                              {doc.orderNumber && doc.orderNumber !== '—' ? (
                                <span className="font-mono tracking-tight">{doc.orderNumber}</span>
                              ) : (
                                <span className="text-[var(--text-muted)] font-mono">—</span>
                              )}
                            </td>

                            {/* 6. File name */}
                            <td className="py-2.5 px-3 border-r border-[#29364A] text-center font-mono font-bold text-[11px] text-[#F1F5F9]">
                              {doc.fileName && doc.fileName !== '—' ? (
                                <span className="px-2 py-0.5 rounded border border-[#29364A] bg-[#0F172A] text-[#60A5FA] font-mono">
                                  {doc.fileName}
                                </span>
                              ) : (
                                <span className="text-[var(--text-muted)] font-mono">—</span>
                              )}
                            </td>

                            {/* 7. Status */}
                            <td className="py-2.5 px-3 border-r border-[#29364A] text-center whitespace-nowrap">
                              {isAvailable ? (
                                <span
                                  className="dms-badge dms-badge-success"
                                  title="Document file is stored and available in the archive"
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>Available</span>
                                </span>
                              ) : (
                                <span
                                  className="dms-badge dms-badge-warning"
                                  title="Document file missing from physical archive"
                                >
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>Missing</span>
                                </span>
                              )}
                            </td>

                            {/* 8. Actions (Preview and Download) */}
                            <td
                              className="py-2.5 px-3 text-center whitespace-nowrap"
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
                                      className="dms-btn-secondary px-2.5 py-1 min-h-[32px] text-[11px]"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-[#60A5FA]" />
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
                                        className="dms-btn-secondary px-2.5 py-1 min-h-[32px] text-[11px]"
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
                                    className="dms-btn-secondary px-2 py-1 min-h-[32px] text-[11px] font-mono text-[var(--text-muted)]"
                                    title="Physical manual file not in repository"
                                  >
                                    <Info className="w-3 h-3 text-[var(--color-warning)]" />
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
      <div className="block md:hidden p-3 space-y-3">
        {categoriesToRender.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">
            <FileText className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)]" />
            <p className="font-semibold text-sm text-[var(--text-primary)]">
              No catalogue entries match the current filter.
            </p>
            <p className="text-xs mt-1 text-[var(--text-muted)]">Try resetting the search or category filters.</p>
          </div>
        ) : (
          categoriesToRender.map((category, catIdx) => {
            const categoryDocs = filteredGrouped[category] || [];
            const isCollapsed = collapsedCategories[category];
            const isPrimary = catIdx % 2 === 0;

            return (
              <div
                key={`mob_cat_${category}`}
                className="rounded-lg border border-[#29364A] overflow-hidden bg-[#101827]"
              >
                {/* Mobile Category Accordion Header (Siemens Coloured Band: Alternating Warm Orange #F59E0B / Light Orange #FDBA74) */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  data-mobile-cat-header="true"
                  data-category={category}
                  data-category-index={catIdx}
                  data-band-type={isPrimary ? 'primary' : 'secondary'}
                  className={`w-full p-3.5 min-h-[44px] flex items-center justify-between text-left transition-colors cursor-pointer border-b border-[#29364A] ${
                    isPrimary
                      ? 'bg-[#F59E0B] hover:bg-[#EAA00A] text-[#292016]'
                      : 'bg-[#FDBA74] hover:bg-[#FBA859] text-[#292016]'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 shrink-0 text-[#292016]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0 text-[#292016]" />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase tracking-wider truncate text-[#292016] font-mono">
                        {category}
                      </div>
                      <div className="text-[10px] font-mono text-[#292016]/80 font-semibold">
                        {categoryDocs.length} {categoryDocs.length === 1 ? 'doc' : 'docs'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded font-bold border border-[#292016]/30 text-[#292016] bg-[#292016]/10 shrink-0">
                    {isCollapsed ? 'EXPAND' : 'COLLAPSE'}
                  </span>
                </button>

                {/* Mobile Document Cards List (Continuous List, No Pagination) */}
                {!isCollapsed && (
                  <div className="divide-y divide-[#29364A]">
                    {categoryDocs.map((doc, idx) => {
                      const isAvailable =
                        doc.status === 'Available' ||
                        (doc.availabilityStatus === 'AVAILABLE' && Boolean(doc.secureUrl));

                      return (
                        <div
                          key={`mob_doc_${doc._id || idx}`}
                          className={`p-3.5 space-y-2.5 transition-colors ${
                            idx % 2 === 1 ? 'bg-[#141C2B]' : 'bg-[#101827]'
                          }`}
                        >
                          {/* Badges: System, SW, Edition, Status */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                            <span className="border border-[#29364A] px-2 py-0.5 rounded font-semibold bg-[#172235] text-[#F1F5F9]">
                              {doc.system && doc.system !== '—' ? doc.system : '—'}
                            </span>
                            {doc.softwareVersion && doc.softwareVersion !== '—' && (
                              <span className="border border-[#29364A] px-1.5 py-0.5 rounded text-[#94A3B8]">
                                SW {doc.softwareVersion}
                              </span>
                            )}
                            {doc.edition && doc.edition !== '—' && (
                              <span className="border border-[#29364A] px-1.5 py-0.5 rounded text-[#94A3B8]">
                                Ed: {doc.edition}
                              </span>
                            )}
                            <span
                              className={`ml-auto dms-badge ${
                                isAvailable ? 'dms-badge-success' : 'dms-badge-warning'
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
                                  ? 'text-[#F1F5F9] group-hover:text-[#60A5FA]'
                                  : 'text-[#94A3B8]'
                              }`}
                            >
                              {doc.title && doc.title !== '—' ? doc.title : '—'}
                            </h4>
                          </div>

                          {/* Order No & File Name */}
                          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono text-[#94A3B8]">
                            <div className="truncate">
                              <span className="text-[var(--text-muted)]">Order:</span>{' '}
                              <span className="font-semibold text-[#F1F5F9]">{doc.orderNumber || '—'}</span>
                            </div>
                            <div className="truncate">
                              <span className="text-[var(--text-muted)]">File:</span>{' '}
                              <span className="font-bold text-[#60A5FA]">
                                {doc.fileName || '—'}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons: touch target >= 44px */}
                          <div className="flex items-center gap-2 pt-1 border-t border-[#29364A]">
                            {isAvailable ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onSelectDocument && onSelectDocument(doc)}
                                  className="dms-btn-secondary flex-1 min-h-[44px] px-3 py-2 text-xs font-semibold"
                                >
                                  <Eye className="w-4 h-4 text-[#60A5FA]" />
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
                                    className="dms-btn-primary flex-1 min-h-[44px] px-3 py-2 text-xs font-semibold"
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
                                className="dms-btn-secondary w-full min-h-[44px] px-3 py-2 text-xs text-[var(--color-warning)]"
                              >
                                <AlertTriangle className="w-4 h-4" />
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
      <div className="border-t border-[#29364A] p-3 px-4 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 bg-[var(--bg-elevated)] text-[var(--text-muted)]">
        <div className="flex items-center space-x-4">
          <span className="font-mono text-[10px] sm:text-[11px] text-center sm:text-left">
            DOConCD 09/2011 Master Catalogue • Siemens SINUMERIK / {isSimodriveMode ? 'SIMODRIVE' : 'SINAMICS'} Reference
          </span>
        </div>
        <div className="font-mono text-[11px] text-[var(--text-secondary)]">
          Total Entries: <strong className="text-[var(--text-primary)]">{filteredDocuments.length}</strong> /{' '}
          <strong className="text-[var(--text-primary)]">{activeCatalogue.length}</strong>
        </div>
      </div>

      {/* Unavailable / Missing Document Info Modal */}
      {unavailableModalDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4">
          <div className="dms-card max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-[var(--color-warning)] shrink-0" />
                <h3 className="font-bold text-sm uppercase tracking-wide text-[var(--text-primary)] font-mono">
                  Document Missing from Archive
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUnavailableModalDoc(null)}
                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              This document is an authentic record in the official Siemens DOConCD SINUMERIK / {isSimodriveMode ? 'SIMODRIVE' : 'SINAMICS'} 09/2011 catalogue,
              but its physical document file has not yet been uploaded to this DMS repository.
            </p>
            <div className="rounded-md border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3.5 text-xs space-y-1.5 font-mono">
              <div>
                <strong className="text-[var(--text-secondary)]">Title:</strong>{' '}
                <span className="text-[var(--text-primary)]">{unavailableModalDoc.title && unavailableModalDoc.title !== '—' ? unavailableModalDoc.title : '—'}</span>
              </div>
              <div>
                <strong className="text-[var(--text-secondary)]">System:</strong>{' '}
                <span className="text-[var(--text-primary)]">{unavailableModalDoc.system && unavailableModalDoc.system !== '—' ? unavailableModalDoc.system : '—'}</span>
              </div>
              <div>
                <strong className="text-[var(--text-secondary)]">SW Version:</strong>{' '}
                <span className="text-[var(--text-primary)]">{unavailableModalDoc.softwareVersion && unavailableModalDoc.softwareVersion !== '—' ? unavailableModalDoc.softwareVersion : '—'}</span>
              </div>
              <div>
                <strong className="text-[var(--text-secondary)]">Edition:</strong>{' '}
                <span className="text-[var(--text-primary)]">{unavailableModalDoc.edition && unavailableModalDoc.edition !== '—' ? unavailableModalDoc.edition : '—'}</span>
              </div>
              <div>
                <strong className="text-[var(--text-secondary)]">Order No.:</strong>{' '}
                <span className="text-[var(--text-primary)]">{unavailableModalDoc.orderNumber && unavailableModalDoc.orderNumber !== '—' ? unavailableModalDoc.orderNumber : '—'}</span>
              </div>
              <div>
                <strong className="text-[var(--text-secondary)]">File name:</strong>{' '}
                <span className="text-[var(--primary-blue)] font-bold">{unavailableModalDoc.fileName && unavailableModalDoc.fileName !== '—' ? unavailableModalDoc.fileName : '—'}</span>
              </div>
              <div>
                <strong className="text-[var(--text-secondary)]">Category:</strong>{' '}
                <span className="text-[var(--text-primary)]">{unavailableModalDoc.category}</span>
              </div>
              <div>
                <strong className="text-[var(--text-secondary)]">Status:</strong>{' '}
                <span className="dms-badge dms-badge-warning">Missing from Archive</span>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setUnavailableModalDoc(null)}
                className="dms-btn-primary px-4 py-2 text-xs"
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
