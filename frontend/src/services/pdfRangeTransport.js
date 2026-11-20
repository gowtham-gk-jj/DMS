/**
 * Enterprise DMS — Custom PDFDataRangeTransport for PDF.js
 * Bridges IndexedDB byte-range caching with HTTP 206 Partial Content Range streaming.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfCacheService from './pdfCacheService';

export class DmsPdfDataRangeTransport extends pdfjsLib.PDFDataRangeTransport {
  constructor(length, initialData, docId, version, streamUrl, token) {
    super(length, initialData, true);
    this.docId = docId;
    this.version = version || 'v1';
    this.streamUrl = streamUrl;
    this.token = token;
    this.abortController = new AbortController();
    this.pendingRanges = new Map();
  }

  /**
   * PDF.js calls requestDataRange when it needs bytes from [begin, end)
   */
  async requestDataRange(begin, end) {
    if (this.abortController.signal.aborted) return;

    const rangeKey = `${begin}-${end}`;
    if (this.pendingRanges.has(rangeKey)) {
      return this.pendingRanges.get(rangeKey);
    }

    const task = (async () => {
      try {
        // 1. Check client-side persistent IndexedDB cache first
        const cached = await pdfCacheService.getByteRange(this.docId, this.version, begin, end - 1);
        if (cached) {
          this.onDataRange(begin, new Uint8Array(cached));
          return;
        }

        // 2. Fetch missing range via HTTP Range request
        const headers = {
          Range: `bytes=${begin}-${end - 1}`,
        };
        if (this.token) {
          headers.Authorization = `Bearer ${this.token}`;
        }

        const res = await fetch(this.streamUrl, {
          method: 'GET',
          headers,
          signal: this.abortController.signal,
          credentials: 'include',
        });

        if (res.status === 206 || res.status === 200) {
          const buffer = await res.arrayBuffer();

          // Store newly streamed range in IndexedDB
          pdfCacheService.putByteRange(
            this.docId,
            this.version,
            begin,
            begin + buffer.byteLength - 1,
            this.length,
            buffer
          ).catch(() => {});

          this.onDataRange(begin, new Uint8Array(buffer));
        } else {
          console.warn(`[RangeTransport] Range request returned status ${res.status}`);
        }
      } catch (err) {
        if (!this.abortController.signal.aborted) {
          console.error(`[RangeTransport] Error streaming range ${begin}-${end}:`, err);
        }
      } finally {
        this.pendingRanges.delete(rangeKey);
      }
    })();

    this.pendingRanges.set(rangeKey, task);
    return task;
  }

  abort() {
    try {
      this.abortController.abort();
    } catch {}
  }
}

export default DmsPdfDataRangeTransport;
