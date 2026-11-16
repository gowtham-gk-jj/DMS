import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const PDFJS_VERSION = pdfjsLib.version || '6.5.438';
const fallbackWorkerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

// Ensure the PDF.js worker matches the installed pdfjs-dist bundle
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker || fallbackWorkerSrc;
}

// Single PDF Page Component with viewport-aware rendering
function PdfPage({
  pdfDoc,
  pageNumber,
  zoom,
  rotation,
  containerWidth,
  isDark,
  onVisible,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [isRendered, setIsRendered] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
  const [error, setError] = useState(null);

  // Measure initial page dimensions once
  useEffect(() => {
    let active = true;
    pdfDoc
      .getPage(pageNumber)
      .then((page) => {
        if (!active) return;
        const unscaled = page.getViewport({ scale: 1, rotation });
        setPageDimensions({ width: unscaled.width, height: unscaled.height });
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [pdfDoc, pageNumber, rotation]);

  // IntersectionObserver to render visible or near-visible pages
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsInView(true);
          if (onVisible) onVisible(pageNumber);
        } else {
          // If scrolled far away, drop canvas memory on mobile
          const rect = entry.boundingClientRect;
          const vh = window.innerHeight || 800;
          if (rect.bottom < -vh || rect.top > vh * 2) {
            setIsInView(false);
            setIsRendered(false);
          }
        }
      },
      {
        rootMargin: '400px 0px',
        threshold: 0.05,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  // Render canvas when page is in view and dimensions are known
  useEffect(() => {
    if (!isInView || !pdfDoc || !canvasRef.current || pageDimensions.width === 0) return;

    let active = true;

    // Cancel in-flight render task if zoom or rotation changed
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {}
      renderTaskRef.current = null;
    }

    pdfDoc
      .getPage(pageNumber)
      .then((page) => {
        if (!active || !canvasRef.current) return;

        // Calculate responsive scale: fit strictly to available screen width
        const screenW = typeof window !== 'undefined' ? window.innerWidth : 390;
        const effectiveContainerW = Math.min(containerWidth || screenW, screenW);
        const availableWidth = Math.max(effectiveContainerW - 20, 240);

        const baseViewport = page.getViewport({ scale: 1, rotation });
        const fitScale = availableWidth / baseViewport.width;
        const effectiveScale = fitScale * (zoom / 100);

        const viewport = page.getViewport({ scale: effectiveScale, rotation });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });

        // High DPI sharpness (Retina/Mobile screens)
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        canvas.style.maxWidth = '100%';

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        return renderTask.promise.then(() => {
          if (active) {
            setIsRendered(true);
            renderTaskRef.current = null;
          }
        });
      })
      .catch((err) => {
        if (err?.name !== 'RenderingCancelledException' && active) {
          console.error(`Page ${pageNumber} render error:`, err);
          setError(err.message || 'Error rendering page.');
        }
      });

    return () => {
      active = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
        renderTaskRef.current = null;
      }
    };
  }, [isInView, pdfDoc, pageNumber, zoom, rotation, containerWidth, pageDimensions]);

  // Placeholder dimensions while waiting to render
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 390;
  const effectiveContainerW = Math.min(containerWidth || screenW, screenW);
  const availableWidth = Math.max(effectiveContainerW - 20, 240);
  const ratio = pageDimensions.height > 0 ? pageDimensions.height / pageDimensions.width : 1.414;
  const placeholderWidth = availableWidth * (zoom / 100);
  const placeholderHeight = placeholderWidth * ratio;

  return (
    <div
      ref={containerRef}
      id={`pdf-page-${pageNumber}`}
      className="my-2.5 flex flex-col items-center justify-center max-w-full overflow-hidden"
      style={{
        minHeight: `${Math.min(placeholderHeight, 350)}px`,
      }}
    >
      <div
        className={`relative shadow-md border transition-colors max-w-full overflow-hidden ${
          isDark
            ? 'bg-[#182234] border-[#243042] text-[#f8fafc]'
            : 'bg-[#ffffff] border-[#e2e8f0] text-[#111111]'
        }`}
        style={{
          width: isRendered && canvasRef.current ? canvasRef.current.style.width : `${placeholderWidth}px`,
          height: isRendered && canvasRef.current ? canvasRef.current.style.height : `${placeholderHeight}px`,
          maxWidth: '100%',
        }}
      >
        <canvas
          ref={canvasRef}
          className={`block max-w-full ${!isRendered ? 'hidden' : ''}`}
        />

        {!isRendered && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-xs text-[#888888]">
            {error ? (
              <div className="text-center text-red-500 p-2">
                <AlertCircle className="w-5 h-5 mx-auto mb-1" />
                <span>Failed to render page {pageNumber}</span>
              </div>
            ) : (
              <div className="text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0284c7]" />
                <span>Rendering Page {pageNumber}...</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className={`text-[10px] font-mono mt-1 select-none ${
          isDark ? 'text-[#64748b]' : 'text-[#94a3b8]'
        }`}
      >
        Page {pageNumber}
      </div>
    </div>
  );
}

export default function PdfViewer({
  data,
  zoom = 100,
  rotation = 0,
  currentPage = 1,
  onTotalPages,
  onCurrentPageChange,
  isDark = true,
}) {
  const containerRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      return Math.min(window.innerWidth - 16, 800);
    }
    return 390;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ResizeObserver to update page width dynamically on mobile orientation change or window resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      if (el) {
        const w = el.clientWidth || window.innerWidth || 390;
        setContainerWidth(Math.min(w, window.innerWidth || w));
      }
    };

    updateWidth();
    const ro = new ResizeObserver(() => updateWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load PDF document from ArrayBuffer / Uint8Array / Blob
  useEffect(() => {
    if (!data) return;

    let active = true;
    let loadingTask = null;
    setLoading(true);
    setError(null);

    const initPdf = async () => {
      try {
        let pdfData = data;
        if (data instanceof Blob) {
          pdfData = await data.arrayBuffer();
        }

        // Clone ArrayBuffer so worker postMessage transfer never detaches the original
        const rawArray =
          pdfData instanceof Uint8Array
            ? pdfData
            : new Uint8Array(pdfData);
        const copyBuffer = rawArray.buffer.slice(
          rawArray.byteOffset,
          rawArray.byteOffset + rawArray.byteLength
        );
        const typedArray = new Uint8Array(copyBuffer);

        loadingTask = pdfjsLib.getDocument({
          data: typedArray,
          wasmUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/wasm/`,
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
        });

        const doc = await loadingTask.promise;
        if (!active) {
          doc.destroy();
          return;
        }

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        if (onTotalPages) onTotalPages(doc.numPages);
      } catch (err) {
        if (!active) return;
        console.error('Failed to parse PDF document:', err);
        setError(err.message || 'Unable to decode PDF document.');
      } finally {
        if (active) setLoading(false);
      }
    };

    initPdf();

    return () => {
      active = false;
      if (loadingTask) {
        try {
          loadingTask.destroy();
        } catch {}
      }
      setPdfDoc((prev) => {
        if (prev) {
          try {
            prev.destroy();
          } catch {}
        }
        return null;
      });
    };
  }, [data, onTotalPages]);

  // Scroll to page when currentPage changes externally (e.g. from toolbar input)
  const scrollToPage = useCallback((pageNum) => {
    const pageEl = document.getElementById(`pdf-page-${pageNum}`);
    if (pageEl && containerRef.current) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    if (currentPage && pdfDoc) {
      scrollToPage(currentPage);
    }
  }, [currentPage, pdfDoc, scrollToPage]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-xs text-[#888888] min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#0284c7]" />
        <span className="font-medium text-sm text-[#f8fafc]">Rendering PDF pages...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-red-400 min-h-[300px]">
        <AlertCircle className="w-8 h-8 mb-2 text-red-500" />
        <p className="font-semibold text-sm mb-1">Failed to Render PDF</p>
        <p className="text-xs text-[#888888] max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center px-1 sm:px-2 py-3 scroll-smooth max-w-full"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {Array.from({ length: numPages }).map((_, idx) => (
        <PdfPage
          key={idx + 1}
          pdfDoc={pdfDoc}
          pageNumber={idx + 1}
          zoom={zoom}
          rotation={rotation}
          containerWidth={containerWidth}
          isDark={isDark}
          onVisible={onCurrentPageChange}
        />
      ))}
    </div>
  );
}
