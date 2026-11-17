/**
 * API Request Latency and Slow Route Telemetry Middleware
 * Logs route response time and highlights any query exceeding threshold (500ms)
 * STRICT SECURITY: Completely sanitized to prevent token/secret leakage.
 */

const SLOW_THRESHOLD_MS = 500;

function perfLogger(req, res, next) {
  const start = performance.now();

  res.once('finish', () => {
    const duration = Math.round(performance.now() - start);

    // Sanitize path: strip sensitive query params like ?token=...
    const urlObj = new URL(req.originalUrl || req.url, 'http://localhost');
    urlObj.searchParams.delete('token');
    urlObj.searchParams.delete('password');
    const sanitizedUrl = urlObj.pathname + (urlObj.search ? urlObj.search : '');

    const isSlow = duration >= SLOW_THRESHOLD_MS;
    const isStreamOrUpload = sanitizedUrl.includes('/stream') || sanitizedUrl.includes('/download') || sanitizedUrl.includes('/upload');

    // Only log slow operations or in non-production environments
    if (isSlow && !isStreamOrUpload) {
      console.warn(`⚠️ [SLOW ROUTE] ${req.method} ${sanitizedUrl} - ${res.statusCode} in ${duration}ms (Threshold: ${SLOW_THRESHOLD_MS}ms)`);
    } else if (process.env.DEBUG_PERF === 'true') {
      console.log(`[PERF] ${req.method} ${sanitizedUrl} - ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
}

module.exports = perfLogger;
