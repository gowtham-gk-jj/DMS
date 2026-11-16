import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { Loader2, AlertCircle, Download, FileText } from 'lucide-react';

export default function DocxViewer({
  data,
  isDark = true,
  canDownload = false,
  onDownload,
  fileName = 'document.docx',
}) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!data || !containerRef.current) return;

    let active = true;
    setLoading(true);
    setError(null);

    const renderDocx = async () => {
      try {
        let buffer = data;
        if (data instanceof Blob) {
          buffer = await data.arrayBuffer();
        }

        // Clean previous content
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        await renderAsync(buffer, containerRef.current, undefined, {
          className: 'docx-preview-content',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
        });

        if (active) setLoading(false);
      } catch (err) {
        if (!active) return;
        console.error('Failed to render DOCX file:', err);
        setError(
          err.message ||
            'Word 97-2003 binary formats (.doc) or unsupported DOCX files cannot be rendered directly in the browser.'
        );
        setLoading(false);
      }
    };

    renderDocx();

    return () => {
      active = false;
    };
  }, [data]);

  return (
    <div className="w-full h-full flex flex-col items-center overflow-auto p-2 sm:p-4">
      {loading && (
        <div className="flex flex-col items-center justify-center p-8 text-xs text-[#888888] min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#0284c7]" />
          <span>Parsing Word Document structure...</span>
        </div>
      )}

      {error ? (
        <div
          className={`max-w-md w-full p-6 text-center border shadow-xl my-auto ${
            isDark
              ? 'bg-[#141c2b] border-[#243042] text-[#f8fafc]'
              : 'bg-[#ffffff] border-[#e2e8f0] text-[#111111]'
          }`}
        >
          <FileText className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-[#60a5fa]' : 'text-[#0284c7]'}`} />
          <h4 className="font-semibold text-sm mb-2">{fileName}</h4>
          <p className={`text-xs mb-4 leading-relaxed ${isDark ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
            This Word document cannot be rendered inline in the browser. You can download the file to view it in Microsoft Word or a compatible office suite.
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
              <span>Download Word Document</span>
            </button>
          )}
        </div>
      ) : (
        <div
          ref={containerRef}
          className={`w-full max-w-4xl shadow-xl border p-4 sm:p-8 transition-colors ${
            isDark
              ? 'bg-[#ffffff] text-[#111111] border-[#243042]'
              : 'bg-[#ffffff] text-[#111111] border-[#e2e8f0]'
          }`}
          style={{
            minHeight: '400px',
            color: '#111111', // DOCX rendered pages are standard white-page documents
          }}
        />
      )}
    </div>
  );
}
