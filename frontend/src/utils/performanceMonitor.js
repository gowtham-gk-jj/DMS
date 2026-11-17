/**
 * Frontend Core Web Vitals and Performance Telemetry Monitor
 * Tracks FCP, LCP, CLS, TTFB, and Document Render Latencies
 */

const isProduction = import.meta.env.PROD;

export const metrics = {
  ttfb: 0,
  fcp: 0,
  lcp: 0,
  cls: 0,
  pdfFirstPageRender: 0,
};

export function initPerformanceMonitoring() {
  if (typeof window === 'undefined' || !window.performance) return;

  // 1. Navigation Timing (TTFB, DOM Interactive, Complete)
  window.addEventListener('load', () => {
    try {
      const [navEntry] = performance.getEntriesByType('navigation');
      if (navEntry) {
        metrics.ttfb = Math.round(navEntry.responseStart - navEntry.requestStart);
        if (!isProduction) {
          console.log(`[Perf] TTFB: ${metrics.ttfb}ms | DomReady: ${Math.round(navEntry.domContentLoadedEventEnd)}ms | TotalLoad: ${Math.round(navEntry.loadEventEnd)}ms`);
        }
      }
    } catch {}
  });

  // 2. First Contentful Paint (FCP)
  if ('PerformanceObserver' in window) {
    try {
      const fcpObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            metrics.fcp = Math.round(entry.startTime);
            if (!isProduction) {
              console.log(`[Perf] FCP: ${metrics.fcp}ms`);
            }
            fcpObserver.disconnect();
          }
        }
      });
      fcpObserver.observe({ type: 'paint', buffered: true });
    } catch {}

    // 3. Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          metrics.lcp = Math.round(lastEntry.startTime);
          if (!isProduction) {
            console.log(`[Perf] LCP: ${metrics.lcp}ms`);
          }
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    // 4. Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            metrics.cls = parseFloat(clsValue.toFixed(4));
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch {}
  }
}

export function recordPdfPageRenderTime(durationMs) {
  metrics.pdfFirstPageRender = durationMs;
  if (!isProduction) {
    console.log(`[Perf] PDF First Page Rendered in ${durationMs}ms`);
  }
}
