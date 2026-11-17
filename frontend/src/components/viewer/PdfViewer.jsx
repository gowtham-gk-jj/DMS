import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { recordPdfPageRenderTime } from '../../utils/performanceMonitor';
import pdfCacheService from '../../services/pdfCacheService';
import DmsPdfDataRangeTransport from '../../services/pdfRangeTransport';

const PDFJS_VERSION = pdfjsLib.version || '6.5.438';
const fallbackWorkerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

// Ensure worker is configured
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker || fallbackWorkerSrc;
}

// 5 Controlled Page Rendering States
export const PAGE_STATUS = {
  NOT_RENDERED: 'NOT_RENDERED',
  QUEUED: 'QUEUED',
  RENDERING: 'RENDERING',
  RENDERED: 'RENDERED',
  ERROR: 'ERROR',
};

// Concurrency limit: maximum 2 concurrent rendering tasks on mobile
const MAX_CONCURRENT_RENDERS = 2;

// Memory safeguard: maximum rendered canvases simultaneously retained for 20+ page documents
const MAX_CACHED_CANVASES = 12;

export default function PdfViewer({
  url = null,
  token = null,
  data = null,
  docId = null,
  version = 'v1',
  fileSize = null,
  documentTitle = null,
  onErrorFallback = null,
  zoom = 100,
  rotation = 0,
  targetPage = null,
  currentPage = 1,
  onTotalPages,
  onCurrentPageChange,
  isDark = true,
}) {
  const containerRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [standardAspectRatio, setStandardAspectRatio] = useState(1.414); // Standard A4 default
  const [pageStatuses, setPageStatuses] = useState({});
  const [pageErrors, setPageErrors] = useState({});
  const [containerWidth, setContainerWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      return Math.min(window.innerWidth - 16, 800);
    }
    return 390;
  });
  const [loading, setLoading] = useState(true);
  const [docError, setDocError] = useState(null);

  // Mutable refs for queue management without re-triggering React effect cascades
  const pdfDocRef = useRef(null);
  pdfDocRef.current = pdfDoc;
  const numPagesRef = useRef(0);
  numPagesRef.current = numPages;

  const pageStatusRef = useRef({});
  const pageErrorsRef = useRef({});
  const renderQueueRef = useRef([]);
  const activeRendersRef = useRef(0);
  const renderTasksRef = useRef({}); // pageNum -> renderTask
  const visiblePagesSetRef = useRef(new Set()); // pages intersecting container + rootMargin
  const renderedCanvasesQueueRef = useRef([]); // FIFO queue of rendered page numbers for cache management

  const pageElementsRef = useRef({});
  const canvasRefs = useRef({});

  const mountTimeRef = useRef(Date.now());
  const pageOneRenderedRef = useRef(false);

  const internalPageRef = useRef(1);
  const isProgrammaticScrollRef = useRef(false);
  const prevScrollRatioRef = useRef(0);
  const rangeTransportRef = useRef(null);

  // ResizeObserver with 8px threshold to prevent scrollbar flicker loops
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId = null;
    const ro = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (el) {
          const w = el.clientWidth || window.innerWidth || 390;
          setContainerWidth((prev) => (Math.abs(prev - w) > 8 ? w : prev));
        }
      });
    });

    ro.observe(el);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  // Compute uniform stable page dimensions: 0px layout shift
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 390;
  const effectiveContainerW = Math.min(containerWidth || screenW, screenW);
  const availableWidth = Math.max(effectiveContainerW - 24, 240);
  const pageWidth = Math.floor(availableWidth * (zoom / 100));
  const pageHeight = Math.floor(pageWidth * (standardAspectRatio || 1.414));

  // Prune off-screen canvas for memory relief on 20+ page PDFs
  const pruneCanvas = useCallback((pageNum) => {
    const canvas = canvasRefs.current[pageNum];
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
      canvas.style.display = 'none';
    }
    pageStatusRef.current[pageNum] = PAGE_STATUS.NOT_RENDERED;
    setPageStatuses((prev) => ({ ...prev, [pageNum]: PAGE_STATUS.NOT_RENDERED }));
  }, []);

  // Render a single page onto its canvas
  const renderPage = useCallback(
    async (pageNum) => {
      const doc = pdfDocRef.current;
      const canvas = canvasRefs.current[pageNum];
      if (!doc || !canvas) return;

      // Cancel previous task for this page if running
      if (renderTasksRef.current[pageNum]) {
        try {
          renderTasksRef.current[pageNum].cancel();
        } catch {}
        delete renderTasksRef.current[pageNum];
      }

      const page = await doc.getPage(pageNum);

      // Calculate scale strictly matching the stable container dimensions
      const baseViewport = page.getViewport({ scale: 1, rotation });
      const fitScale = pageWidth / baseViewport.width;
      const viewport = page.getViewport({ scale: fitScale, rotation });

      // Cap devicePixelRatio at 2 to conserve mobile GPU RAM
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.style.maxWidth = '100%';
      canvas.style.display = 'block';

      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      const task = page.render(renderContext);
      renderTasksRef.current[pageNum] = task;

      await task.promise;
      delete renderTasksRef.current[pageNum];
    },
    [pageWidth, rotation]
  );

  // Queue orchestrator with max 2 concurrent render tasks
  const processQueue = useCallback(() => {
    if (activeRendersRef.current >= MAX_CONCURRENT_RENDERS || renderQueueRef.current.length === 0) {
      return;
    }

    if (!pdfDocRef.current) return;

    // Prioritize visible pages and sort by proximity to current center page
    const centerPage = internalPageRef.current || 1;
    renderQueueRef.current.sort((a, b) => {
      const aVisible = visiblePagesSetRef.current.has(a);
      const bVisible = visiblePagesSetRef.current.has(b);
      if (aVisible && !bVisible) return -1;
      if (!aVisible && bVisible) return 1;
      return Math.abs(a - centerPage) - Math.abs(b - centerPage);
    });

    const nextPg = renderQueueRef.current.shift();
    if (!nextPg) return;

    if (pageStatusRef.current[nextPg] !== PAGE_STATUS.QUEUED) {
      processQueue();
      return;
    }

    // Mark as RENDERING
    pageStatusRef.current[nextPg] = PAGE_STATUS.RENDERING;
    activeRendersRef.current++;
    setPageStatuses((prev) => ({ ...prev, [nextPg]: PAGE_STATUS.RENDERING }));

    renderPage(nextPg)
      .then(() => {
        pageStatusRef.current[nextPg] = PAGE_STATUS.RENDERED;
        setPageStatuses((prev) => ({ ...prev, [nextPg]: PAGE_STATUS.RENDERED }));

        if (nextPg === 1 && !pageOneRenderedRef.current) {
          pageOneRenderedRef.current = true;
          recordPdfPageRenderTime(Date.now() - mountTimeRef.current);
        }

        // Memory cache pruning for large manuals
        if (numPagesRef.current > 20) {
          renderedCanvasesQueueRef.current.push(nextPg);
          if (renderedCanvasesQueueRef.current.length > MAX_CACHED_CANVASES) {
            const candidate = renderedCanvasesQueueRef.current.shift();
            if (
              candidate &&
              !visiblePagesSetRef.current.has(candidate) &&
              Math.abs(candidate - internalPageRef.current) > 5
            ) {
              pruneCanvas(candidate);
            }
          }
        }
      })
      .catch((err) => {
        if (err?.name === 'RenderingCancelledException') {
          return; // Intentionally canceled
        }
        console.error(`[PDF Render Error] Page ${nextPg}:`, err);
        pageStatusRef.current[nextPg] = PAGE_STATUS.ERROR;
        setPageErrors((prev) => ({ ...prev, [nextPg]: err.message || 'Render failed' }));
        setPageStatuses((prev) => ({ ...prev, [nextPg]: PAGE_STATUS.ERROR }));
      })
      .finally(() => {
        activeRendersRef.current = Math.max(0, activeRendersRef.current - 1);
        processQueue();
      });
  }, [renderPage, pruneCanvas]);

  // Enqueue a page for controlled rendering
  const enqueuePage = useCallback(
    (pageNum, priority = false) => {
      const currentStatus = pageStatusRef.current[pageNum] || PAGE_STATUS.NOT_RENDERED;
      if (currentStatus === PAGE_STATUS.RENDERED || currentStatus === PAGE_STATUS.RENDERING) {
        return;
      }

      pageStatusRef.current[pageNum] = PAGE_STATUS.QUEUED;
      setPageStatuses((prev) => (prev[pageNum] === PAGE_STATUS.QUEUED ? prev : { ...prev, [pageNum]: PAGE_STATUS.QUEUED }));

      if (!renderQueueRef.current.includes(pageNum)) {
        if (priority) {
          renderQueueRef.current.unshift(pageNum);
        } else {
          renderQueueRef.current.push(pageNum);
        }
      }

      processQueue();
    },
    [processQueue]
  );

  // Manual retry handler for failed pages
  const handleRetryPage = useCallback(
    (pageNum) => {
      pageStatusRef.current[pageNum] = PAGE_STATUS.QUEUED;
      setPageErrors((prev) => {
        const copy = { ...prev };
        delete copy[pageNum];
        return copy;
      });
      enqueuePage(pageNum, true);
    },
    [enqueuePage]
  );

  // Load PDF document from ArrayBuffer / Blob
  useEffect(() => {
    if (!url && !data) return;

    let active = true;
    let loadingTask = null;
    setLoading(true);
    setDocError(null);

    const initPdf = async () => {
      try {
        if (data) {
          let pdfData = data;
          if (data instanceof Blob) {
            pdfData = await data.arrayBuffer();
          }

          // Clone buffer to avoid detachment issues in worker
          const rawArray = pdfData instanceof Uint8Array ? pdfData : new Uint8Array(pdfData);
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
        } else if (docId) {
          const safeVer = version || 'v1';

          // 1. Instant Preview: Check if complete document is already cached in IndexedDB
          const cachedFull = await pdfCacheService.getCompleteBuffer(docId, safeVer).catch(() => null);
          if (cachedFull && active) {
            const typedArray = new Uint8Array(cachedFull.slice(0));
            loadingTask = pdfjsLib.getDocument({
              data: typedArray,
              wasmUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/wasm/`,
              cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
              cMapPacked: true,
              standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
            });
          } else {
            // 2. Instant First Page: Check if initial byte range (bytes 0-65535) is pre-cached
            const cachedRange = await pdfCacheService.getByteRange(docId, safeVer, 0, 65535).catch(() => null);

            if (cachedRange && url && active) {
              const totalLen = Number(fileSize) || cachedRange.byteLength || 1048576;
              const transport = new DmsPdfDataRangeTransport(
                totalLen,
                new Uint8Array(cachedRange),
                docId,
                safeVer,
                url,
                token
              );
              rangeTransportRef.current = transport;

              loadingTask = pdfjsLib.getDocument({
                range: transport,
                rangeChunkSize: 65536,
                disableAutoFetch: true,
                disableStream: false,
                wasmUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/wasm/`,
                cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
                cMapPacked: true,
                standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
              });
            }
          }
        }

        // 3. Fallback: If not loaded from cache, use standard HTTP Range streaming via URL
        if (!loadingTask && url && active) {
          const params = {
            url,
            rangeChunkSize: 65536,
            disableAutoFetch: true,
            disableStream: false,
            withCredentials: true,
            wasmUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/wasm/`,
            cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
            cMapPacked: true,
            standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
          };
          if (token) {
            params.httpHeaders = {
              Authorization: `Bearer ${token}`,
            };
          }
          loadingTask = pdfjsLib.getDocument(params);
        }

        if (!loadingTask) {
          throw new Error('No valid PDF stream source or cached data available.');
        }

        const doc = await loadingTask.promise;
        if (!active) {
          doc.destroy();
          return;
        }

        // Measure Page 1 viewport aspect ratio to stabilize placeholders
        try {
          const firstPage = await doc.getPage(1);
          const vp = firstPage.getViewport({ scale: 1, rotation: 0 });
          if (vp.width > 0 && vp.height > 0) {
            setStandardAspectRatio(vp.height / vp.width);
          }
        } catch (e) {
          console.warn('Could not read Page 1 aspect ratio, using default 1.414:', e);
        }

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        numPagesRef.current = doc.numPages;

        // Initialize status map
        const initialStatuses = {};
        for (let i = 1; i <= doc.numPages; i++) {
          initialStatuses[i] = PAGE_STATUS.NOT_RENDERED;
          pageStatusRef.current[i] = PAGE_STATUS.NOT_RENDERED;
        }
        setPageStatuses(initialStatuses);

        if (onTotalPages) onTotalPages(doc.numPages);

        // Immediately enqueue Page 1 as high priority
        setTimeout(() => {
          if (active) enqueuePage(1, true);
        }, 50);
      } catch (err) {
        if (!active) return;
        console.error('Failed to parse PDF document:', err);
        if (url && onErrorFallback) {
          onErrorFallback(err);
          return;
        }
        setDocError(err.message || 'Unable to decode PDF document.');
      } finally {
        if (active) setLoading(false);
      }
    };

    initPdf();

    return () => {
      active = false;
      // Abort range transport if active
      if (rangeTransportRef.current) {
        try {
          rangeTransportRef.current.abort();
        } catch {}
        rangeTransportRef.current = null;
      }
      // Cancel all in-flight render tasks
      Object.keys(renderTasksRef.current).forEach((p) => {
        try {
          renderTasksRef.current[p]?.cancel();
        } catch {}
      });
      renderTasksRef.current = {};
      renderQueueRef.current = [];
      activeRendersRef.current = 0;

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
  }, [url, token, data, docId, version, fileSize, onErrorFallback, onTotalPages, enqueuePage]);

  // When zoom or rotation changes: cancel running tasks and re-render visible pages without shifting scroll
  useEffect(() => {
    if (!pdfDoc) return;

    // Record scroll ratio before dimensions change
    const container = containerRef.current;
    if (container && container.scrollHeight > 0) {
      prevScrollRatioRef.current = container.scrollTop / container.scrollHeight;
    }

    // Cancel all running render tasks
    Object.keys(renderTasksRef.current).forEach((p) => {
      try {
        renderTasksRef.current[p]?.cancel();
      } catch {}
    });
    renderTasksRef.current = {};
    renderQueueRef.current = [];
    activeRendersRef.current = 0;

    // Reset status of pages
    const resetStatuses = {};
    for (let i = 1; i <= numPages; i++) {
      resetStatuses[i] = PAGE_STATUS.NOT_RENDERED;
      pageStatusRef.current[i] = PAGE_STATUS.NOT_RENDERED;
    }
    setPageStatuses(resetStatuses);

    // Re-enqueue currently visible pages
    visiblePagesSetRef.current.forEach((pageNum) => {
      enqueuePage(pageNum, true);
    });

    // If visible set is empty, re-enqueue page 1
    if (visiblePagesSetRef.current.size === 0) {
      enqueuePage(1, true);
    }

    // Restore scroll position after DOM paints
    requestAnimationFrame(() => {
      if (container && prevScrollRatioRef.current > 0) {
        container.scrollTop = prevScrollRatioRef.current * container.scrollHeight;
      }
    });
  }, [zoom, rotation, pdfDoc, numPages, enqueuePage]);

  // IntersectionObserver: Attached strictly to scroll container root with 300px rootMargin
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pdfDoc || numPages === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNum = parseInt(entry.target.getAttribute('data-page-number'), 10);
          if (!pageNum) return;

          if (entry.isIntersecting) {
            visiblePagesSetRef.current.add(pageNum);
            enqueuePage(pageNum, false);
          } else {
            visiblePagesSetRef.current.delete(pageNum);
          }
        });
      },
      {
        root: container,
        rootMargin: '300px 0px 300px 0px',
        threshold: [0, 0.1],
      }
    );

    // Observe each registered page container
    for (let p = 1; p <= numPages; p++) {
      const el = pageElementsRef.current[p];
      if (el) observer.observe(el);
    }

    return () => {
      observer.disconnect();
    };
  }, [pdfDoc, numPages, enqueuePage]);

  // Passive scroll listener for toolbar page indicator: NEVER triggers automatic scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0) return;

    let rafId = null;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!container) return;
        const scrollTop = container.scrollTop;
        const clientHeight = container.clientHeight;
        const centerY = scrollTop + clientHeight / 2;

        if (container.scrollHeight > 0) {
          prevScrollRatioRef.current = scrollTop / container.scrollHeight;
        }

        // Determine which page center is closest to container centerY
        let closestPage = 1;
        let minDistance = Infinity;

        for (let p = 1; p <= numPages; p++) {
          const el = pageElementsRef.current[p];
          if (el) {
            const midY = el.offsetTop + el.offsetHeight / 2;
            const dist = Math.abs(midY - centerY);
            if (dist < minDistance) {
              minDistance = dist;
              closestPage = p;
            }
          }
        }

        if (closestPage !== internalPageRef.current) {
          internalPageRef.current = closestPage;
          if (onCurrentPageChange) {
            onCurrentPageChange(closestPage);
          }
        }
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [numPages, onCurrentPageChange]);

  // Programmatic Page Jump: ONLY fires when user explicitly clicks toolbar Prev/Next/Jump buttons
  useEffect(() => {
    if (!targetPage?.page || !containerRef.current) return;
    const targetNum = targetPage.page;
    const el = pageElementsRef.current[targetNum];

    if (el && containerRef.current) {
      isProgrammaticScrollRef.current = true;
      internalPageRef.current = targetNum;

      // Prioritize rendering target page immediately
      enqueuePage(targetNum, true);

      const targetScrollTop = el.offsetTop - 10;
      containerRef.current.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });

      const timer = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [targetPage, enqueuePage]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-xs text-[#888888] min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#0284c7]" />
        <span className="font-medium text-sm text-[#f8fafc]">Initializing PDF engine...</span>
      </div>
    );
  }

  if (docError) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-red-400 min-h-[300px]">
        <AlertCircle className="w-8 h-8 mb-2 text-red-500" />
        <p className="font-semibold text-sm mb-1">Failed to Render PDF</p>
        <p className="text-xs text-[#888888] max-w-md">{docError}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center px-1 sm:px-2 py-3 max-w-full"
      style={{
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
      }}
    >
      {Array.from({ length: numPages }).map((_, idx) => {
        const pageNum = idx + 1;
        const status = pageStatuses[pageNum] || PAGE_STATUS.NOT_RENDERED;
        const isRendered = status === PAGE_STATUS.RENDERED;
        const isError = status === PAGE_STATUS.ERROR;
        const isRendering = status === PAGE_STATUS.RENDERING || status === PAGE_STATUS.QUEUED;
        const errorMsg = pageErrors[pageNum];

        return (
          <div
            key={pageNum}
            ref={(el) => (pageElementsRef.current[pageNum] = el)}
            id={`pdf-page-${pageNum}`}
            data-page-number={pageNum}
            className="my-3 flex flex-col items-center justify-center max-w-full overflow-hidden select-none"
            style={{
              width: `${pageWidth}px`,
              minHeight: `${pageHeight}px`,
              height: `${pageHeight}px`,
            }}
          >
            <div
              className={`relative shadow-md border transition-colors max-w-full overflow-hidden flex items-center justify-center ${
                isDark
                  ? 'bg-[#182234] border-[#243042] text-[#f8fafc]'
                  : 'bg-[#ffffff] border-[#e2e8f0] text-[#111111]'
              }`}
              style={{
                width: `${pageWidth}px`,
                height: `${pageHeight}px`,
                maxWidth: '100%',
              }}
            >
              {/* HTML5 Canvas element: hidden until render completes */}
              <canvas
                ref={(el) => (canvasRefs.current[pageNum] = el)}
                className={`block max-w-full ${!isRendered ? 'hidden' : ''}`}
              />

              {/* Controlled placeholder states */}
              {!isRendered && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-xs">
                  {isError ? (
                    <div className="text-center p-4 max-w-xs">
                      <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-500" />
                      <p className="text-red-400 font-semibold mb-1">Page {pageNum} render failed</p>
                      <p className="text-[11px] text-[#888888] mb-3">{errorMsg || 'Decompression error'}</p>
                      <button
                        type="button"
                        onClick={() => handleRetryPage(pageNum)}
                        className="px-3 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded font-medium flex items-center justify-center mx-auto space-x-1 cursor-pointer transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        <span>Retry Page</span>
                      </button>
                    </div>
                  ) : isRendering ? (
                    <div className="text-center text-[#888888]">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0284c7]" />
                      <span className="font-mono text-xs">Loading Page {pageNum}...</span>
                    </div>
                  ) : (
                    <div className="text-center text-[#64748b]">
                      <div className="w-8 h-8 rounded-full border border-slate-700/50 flex items-center justify-center mx-auto mb-1">
                        <span className="text-[11px] font-mono">{pageNum}</span>
                      </div>
                      <span className="text-[10px] text-[#555555]">Page {pageNum}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div
              className={`text-[10px] font-mono mt-1.5 select-none ${
                isDark ? 'text-[#64748b]' : 'text-[#94a3b8]'
              }`}
            >
              Page {pageNum} of {numPages}
            </div>
          </div>
        );
      })}
    </div>
  );
}