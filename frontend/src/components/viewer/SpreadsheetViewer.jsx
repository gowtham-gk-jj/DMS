import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Loader2, Table, Search, AlertCircle, Download, FileSpreadsheet } from 'lucide-react';

export default function SpreadsheetViewer({
  data,
  isDark = true,
  canDownload = false,
  onDownload,
  fileName = 'spreadsheet.xlsx',
}) {
  const [loading, setLoading] = useState(true);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!data) return;

    let active = true;
    setLoading(true);
    setError(null);

    const parseSpreadsheet = async () => {
      try {
        let buffer = data;
        if (data instanceof Blob) {
          buffer = await data.arrayBuffer();
        }

        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        if (!active) return;

        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          throw new Error('Workbook contains no sheets.');
        }

        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        setActiveSheet(wb.SheetNames[0]);
      } catch (err) {
        if (!active) return;
        console.error('Failed to parse spreadsheet:', err);
        setError(
          err.message ||
            'Spreadsheet format could not be decoded. The file may be password protected or corrupted.'
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    parseSpreadsheet();

    return () => {
      active = false;
    };
  }, [data]);

  // Convert current sheet to 2D array
  const { rows, maxCols } = useMemo(() => {
    if (!workbook || !activeSheet || !workbook.Sheets[activeSheet]) {
      return { rows: [], maxCols: 0 };
    }

    const sheet = workbook.Sheets[activeSheet];
    const dataRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });

    let maxColCount = 0;
    dataRows.forEach((row) => {
      if (Array.isArray(row) && row.length > maxColCount) {
        maxColCount = row.length;
      }
    });

    return { rows: dataRows, maxCols: Math.min(maxColCount, 100) };
  }, [workbook, activeSheet]);

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((row) =>
      row.some((cell) => String(cell || '').toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  // Helper for column letters: 0 -> A, 1 -> B, 26 -> AA...
  const getColLetter = (index) => {
    let letter = '';
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-xs text-[#888888] min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#0284c7]" />
        <span>Parsing spreadsheet workbooks...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`max-w-md w-full p-6 text-center border shadow-xl m-auto ${
          isDark
            ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
            : 'bg-[#ffffff] border-[#e2e8f0] text-[#111111]'
        }`}
      >
        <FileSpreadsheet
          className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-[#34d399]' : 'text-[#059669]'}`}
        />
        <h4 className="font-semibold text-sm mb-2">{fileName}</h4>
        <p className={`text-xs mb-4 leading-relaxed ${isDark ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
          {error}
        </p>
        {canDownload && (
          <button
            type="button"
            onClick={onDownload}
            className={`w-full py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#f8fafc] text-[#0b0f17] hover:bg-[#e2e8f0]'
                : 'bg-[#111111] text-[#ffffff] hover:bg-[#333333]'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download Original Spreadsheet</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col min-w-0">
      {/* Top Bar: Sheet selector & Search filter */}
      <div
        className={`border-b p-2 flex flex-wrap items-center justify-between gap-2 shrink-0 ${
          isDark
            ? 'bg-[#0f172a] border-[#243042] text-[#f8fafc]'
            : 'bg-[#f8fafc] border-[#e2e8f0] text-[#111111]'
        }`}
      >
        {/* Sheet Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto max-w-full py-0.5">
          {sheetNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveSheet(name)}
              className={`px-3 py-1 text-xs font-mono border whitespace-nowrap cursor-pointer transition-colors ${
                activeSheet === name
                  ? isDark
                    ? 'bg-[#0284c7] border-[#0284c7] text-[#ffffff] font-semibold'
                    : 'bg-[#0284c7] border-[#0284c7] text-[#ffffff] font-semibold'
                  : isDark
                  ? 'bg-[#1e293b] border-[#334155] text-[#94a3b8] hover:text-[#ffffff]'
                  : 'bg-[#ffffff] border-[#cbd5e1] text-[#475569] hover:bg-[#f1f5f9]'
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Quick cell filter */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div
            className={`flex items-center border px-2 py-1 w-full sm:w-48 text-xs ${
              isDark
                ? 'bg-[#1e293b] border-[#334155] text-[#f8fafc]'
                : 'bg-[#ffffff] border-[#cbd5e1] text-[#111111]'
            }`}
          >
            <Search className="w-3.5 h-3.5 mr-1.5 shrink-0 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Filter sheet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent outline-hidden text-xs"
            />
          </div>
        </div>
      </div>

      {/* Spreadsheet Grid Table */}
      <div className="flex-1 overflow-auto min-w-0 min-h-0 bg-transparent">
        {filteredRows.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#888888]">
            No records found in this sheet.
          </div>
        ) : (
          <table className="border-collapse table-auto text-xs w-full font-mono select-text">
            <thead
              className={`sticky top-0 z-10 shadow-xs ${
                isDark ? 'bg-[#1e293b] text-[#94a3b8]' : 'bg-[#f1f5f9] text-[#475569]'
              }`}
            >
              <tr>
                <th
                  className={`border p-1.5 w-12 text-center text-[10px] font-semibold select-none sticky left-0 z-20 ${
                    isDark
                      ? 'bg-[#1e293b] border-[#334155]'
                      : 'bg-[#f1f5f9] border-[#cbd5e1]'
                  }`}
                >
                  #
                </th>
                {Array.from({ length: maxCols }).map((_, cIdx) => (
                  <th
                    key={cIdx}
                    className={`border px-3 py-1.5 text-center text-[10px] font-semibold min-w-[80px] max-w-[200px] truncate ${
                      isDark ? 'border-[#334155]' : 'border-[#cbd5e1]'
                    }`}
                  >
                    {getColLetter(cIdx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className={`border-b hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                    rIdx % 2 === 0
                      ? isDark
                        ? 'bg-[#0f172a]'
                        : 'bg-[#ffffff]'
                      : isDark
                      ? 'bg-[#131d2e]'
                      : 'bg-[#f8fafc]'
                  }`}
                >
                  {/* Sticky Row Number Index */}
                  <td
                    className={`border px-2 py-1 text-center text-[10px] select-none sticky left-0 z-10 font-bold ${
                      isDark
                        ? 'bg-[#1e293b] border-[#334155] text-[#64748b]'
                        : 'bg-[#f1f5f9] border-[#cbd5e1] text-[#94a3b8]'
                    }`}
                  >
                    {rIdx + 1}
                  </td>

                  {/* Cell Data */}
                  {Array.from({ length: maxCols }).map((_, cIdx) => {
                    const cellVal = row[cIdx] !== undefined ? String(row[cIdx]) : '';
                    return (
                      <td
                        key={cIdx}
                        title={cellVal}
                        className={`border px-2 py-1 truncate max-w-[240px] text-left ${
                          isDark
                            ? 'border-[#243042] text-[#f8fafc]'
                            : 'border-[#e2e8f0] text-[#111111]'
                        }`}
                      >
                        {cellVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Spreadsheet Status Footer */}
      <div
        className={`border-t px-3 py-1.5 text-[10px] font-mono flex items-center justify-between shrink-0 ${
          isDark
            ? 'bg-[#0f172a] border-[#243042] text-[#64748b]'
            : 'bg-[#f8fafc] border-[#e2e8f0] text-[#94a3b8]'
        }`}
      >
        <span>
          Sheet: <strong>{activeSheet}</strong> ({filteredRows.length} rows, {maxCols} columns)
        </span>
        {searchQuery && (
          <span className="text-[#0284c7]">Filtered by "{searchQuery}"</span>
        )}
      </div>
    </div>
  );
}
