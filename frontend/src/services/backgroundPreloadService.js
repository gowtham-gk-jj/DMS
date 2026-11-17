/**
 * Enterprise DMS — Background Preload & Cache Warming Service
 * Manages post-login cache warming across 4 strict priority stages:
 *  - Priority 1 (Immediate): User, Permissions, Dashboard Summary
 *  - Priority 2 (Library): Folder Hierarchy & Document Counts
 *  - Priority 3 (Catalogue): Isolated SINAMICS & SIMODRIVE Catalogues
 *  - Priority 4 (PDF Previews): Initial Byte Ranges (Max 2 Concurrency)
 *
 * Concurrency control, tab visibility handling, offline detection, and LRU safety.
 */

import api from './api';
import pdfCacheService from './pdfCacheService';

export const PRELOAD_STATE = {
  IDLE: 'IDLE',
  PREPARING: 'PREPARING',
  LIBRARY_READY: 'LIBRARY_READY',
  DOCUMENTS_READY: 'DOCUMENTS_READY',
  PAUSED: 'PAUSED',
  OFFLINE: 'OFFLINE',
};

class BackgroundPreloadService {
  constructor() {
    this.state = PRELOAD_STATE.IDLE;
    this.statusMessage = '';
    this.listeners = new Set();

    this.activeUser = null;
    this.token = null;
    this.isRunning = false;
    this.isPaused = false;
    this.abortController = null;

    // Concurrency control for PDF prefetching (max 2 concurrent requests)
    this.MAX_CONCURRENT_PDF_PREFETCH = 2;
    this.activePdfPrefetches = 0;
    this.pdfPrefetchQueue = [];
    this.inFlightPdfPromises = new Map(); // docId -> Promise
    this.permanentFailedDocIds = new Set(); // 404 / 403 do not retry

    // Bind event handlers
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  /**
   * Subscribe to status changes for UI indicator
   */
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state, this.statusMessage);
    return () => this.listeners.delete(listener);
  }

  notify(state, message) {
    this.state = state;
    this.statusMessage = message;
    this.listeners.forEach((fn) => {
      try {
        fn(this.state, this.statusMessage);
      } catch {}
    });
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.isPaused = true;
      if (this.isRunning && this.state !== PRELOAD_STATE.OFFLINE) {
        this.notify(PRELOAD_STATE.PAUSED, 'Background preparation paused');
      }
    } else {
      if (this.isPaused) {
        this.isPaused = false;
        if (this.isRunning) {
          this.notify(PRELOAD_STATE.PREPARING, 'Preparing your workspace...');
          this.drainPdfQueue();
        }
      }
    }
  }

  handleOffline() {
    this.notify(PRELOAD_STATE.OFFLINE, 'Offline — background sync paused');
  }

  handleOnline() {
    if (this.isRunning) {
      this.notify(PRELOAD_STATE.PREPARING, 'Reconnected — resuming workspace preparation');
      this.drainPdfQueue();
    }
  }

  /**
   * Start the 4-phase warming process after verified authentication
   */
  async start(user, token) {
    if (!user || !token) return;
    if (this.isRunning && this.activeUser?._id === user._id) return;

    this.stop(); // Stop any previous session
    this.activeUser = user;
    this.token = token;
    this.isRunning = true;
    this.isPaused = false;
    this.abortController = new AbortController();

    this.notify(PRELOAD_STATE.PREPARING, 'Preparing your workspace...');

    try {
      // ----------------------------------------------------
      // PRIORITY 1 — Immediate Workspace Essentials
      // ----------------------------------------------------
      await this.runPriority1();
      if (!this.isRunning) return;

      // ----------------------------------------------------
      // PRIORITY 2 — Library Hierarchy & Folder Tree
      // ----------------------------------------------------
      await this.runPriority2();
      if (!this.isRunning) return;
      this.notify(PRELOAD_STATE.LIBRARY_READY, 'Library ready');

      // ----------------------------------------------------
      // PRIORITY 3 — Official Catalogues (SINAMICS & SIMODRIVE)
      // ----------------------------------------------------
      const topCatalogueDocs = await this.runPriority3();
      if (!this.isRunning) return;

      // ----------------------------------------------------
      // PRIORITY 4 — Initial PDF Byte Ranges & Metadata
      // ----------------------------------------------------
      await this.runPriority4(topCatalogueDocs);
      if (!this.isRunning) return;

      this.notify(PRELOAD_STATE.DOCUMENTS_READY, 'Workspace ready');

      // Transition to clean idle after 3 seconds
      setTimeout(() => {
        if (this.isRunning && this.state === PRELOAD_STATE.DOCUMENTS_READY) {
          this.notify(PRELOAD_STATE.IDLE, '');
        }
      }, 3000);
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.warn('[PreloadService] Background warming encountered error:', err.message);
      }
      this.notify(PRELOAD_STATE.IDLE, '');
    }
  }

  /**
   * Priority 1: User Profile & Root Dashboard Summary
   */
  async runPriority1() {
    const promises = [
      api.get('/folders?parentId=root').catch(() => null),
    ];

    if (this.activeUser.role === 'ADMIN') {
      promises.push(api.get('/admin/stats').catch(() => null));
    }

    await Promise.all(promises);
  }

  /**
   * Priority 2: Primary Folders Hierarchy & Metadata
   */
  async runPriority2() {
    try {
      const rootRes = await api.get('/folders?parentId=root');
      const rootFolders = rootRes.data?.folders || [];

      // Warm the primary SINAMICS folder details in the background
      const sinamicsFolder = rootFolders.find((f) =>
        f.name?.includes('SINAMICS') || f._id === '6af9f26ff959aeeb3d00e1c9'
      );

      if (sinamicsFolder && this.isRunning) {
        await Promise.all([
          api.get(`/folders/${sinamicsFolder._id}`).catch(() => null),
          api.get(`/folders?parentId=${sinamicsFolder._id}`).catch(() => null),
        ]);
      }
    } catch {}
  }

  /**
   * Priority 3: Isolated SINAMICS & SIMODRIVE Catalogues
   */
  async runPriority3() {
    try {
      const [sinamicsRes, simodriveRes] = await Promise.all([
        api.get('/documents/catalogue/sinamics').catch(() => null),
        api.get('/documents/catalogue/simodrive').catch(() => null),
      ]);

      const sinDocs = sinamicsRes?.data?.documents || [];
      return sinDocs;
    } catch {
      return [];
    }
  }

  /**
   * Priority 4: PDF Preview Preparation (Initial Byte Ranges)
   */
  async runPriority4(topCatalogueDocs = []) {
    if (!this.isRunning) return;

    // Collect prioritised list of documents
    const docList = [];

    // 1. Recently opened documents by the current user
    const recentViewsKey = `dms_recent_views_${this.activeUser._id}`;
    let recentIds = [];
    try {
      const saved = localStorage.getItem(recentViewsKey);
      if (saved) recentIds = JSON.parse(saved);
    } catch {}

    recentIds.slice(0, 5).forEach((id) => {
      if (id && !docList.some((d) => d._id === id)) {
        docList.push({ _id: id, priority: 'HIGH' });
      }
    });

    // 2. High-value official catalogue documents (first 6 available entries)
    topCatalogueDocs
      .filter((d) => d.status === 'Available' || d.availabilityStatus === 'AVAILABLE')
      .slice(0, 6)
      .forEach((d) => {
        if (d._id && !docList.some((item) => item._id === d._id)) {
          docList.push({
            _id: d._id,
            title: d.title,
            originalFileName: d.fileName,
            fileSize: d.fileSize || 1048576,
            version: d.updatedAt || 'v1',
            priority: 'NORMAL',
          });
        }
      });

    // Enqueue for background prefetch
    this.pdfPrefetchQueue = docList;
    this.drainPdfQueue();
  }

  /**
   * Drain PDF prefetch queue respecting max 2 concurrent requests
   */
  drainPdfQueue() {
    if (!this.isRunning || this.isPaused || !navigator.onLine) return;

    while (
      this.activePdfPrefetches < this.MAX_CONCURRENT_PDF_PREFETCH &&
      this.pdfPrefetchQueue.length > 0
    ) {
      const item = this.pdfPrefetchQueue.shift();
      if (!item || !item._id || this.permanentFailedDocIds.has(item._id)) continue;

      this.activePdfPrefetches++;
      this.prefetchPdfInitialRange(item).finally(() => {
        this.activePdfPrefetches = Math.max(0, this.activePdfPrefetches - 1);
        this.drainPdfQueue();
      });
    }
  }

  /**
   * Prefetch document metadata + first 64KB range chunk
   */
  async prefetchPdfInitialRange(docItem) {
    const docId = docItem._id;
    if (this.permanentFailedDocIds.has(docId)) return;

    // If already in flight, reuse promise
    if (this.inFlightPdfPromises.has(docId)) {
      return this.inFlightPdfPromises.get(docId);
    }

    const task = (async () => {
      try {
        // 1. Check if range 0-65535 is already cached in IndexedDB
        const version = docItem.version || 'v1';
        const cachedRange = await pdfCacheService.getByteRange(docId, version, 0, 65535);
        if (cachedRange) {
          return true;
        }

        // 2. Fetch document preview metadata
        let metadata = await pdfCacheService.getDocMetadata(docId);
        if (!metadata) {
          const previewRes = await api.get(`/documents/${docId}/preview`, {
            signal: this.abortController?.signal,
          });
          if (previewRes.data?.success) {
            metadata = previewRes.data.document;
            await pdfCacheService.putDocMetadata(docId, metadata);
          }
        }

        if (!metadata) return false;

        // 3. Fetch first 64 KB byte range (bytes=0-65535) via HTTP Range request
        const rawApiUrl = api.defaults.baseURL || '/api';
        const streamUrl = `${rawApiUrl}/documents/${docId}/stream`;

        const res = await fetch(streamUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.token}`,
            Range: 'bytes=0-65535',
          },
          signal: this.abortController?.signal,
          credentials: 'include',
        });

        if (res.status === 206 || res.status === 200) {
          const buffer = await res.arrayBuffer();
          const totalSize = metadata.fileSize || buffer.byteLength;
          await pdfCacheService.putByteRange(
            docId,
            version,
            0,
            buffer.byteLength - 1,
            totalSize,
            buffer
          );
          return true;
        } else if (res.status === 404 || res.status === 403) {
          this.permanentFailedDocIds.add(docId);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          // Bounded retry or ignore
        }
      } finally {
        this.inFlightPdfPromises.delete(docId);
      }
      return false;
    })();

    this.inFlightPdfPromises.set(docId, task);
    return task;
  }

  /**
   * Stop background service and abort pending tasks
   */
  stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.activeUser = null;
    this.token = null;
    this.pdfPrefetchQueue = [];
    this.inFlightPdfPromises.clear();
    this.activePdfPrefetches = 0;

    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
      this.abortController = null;
    }

    this.notify(PRELOAD_STATE.IDLE, '');
  }

  /**
   * Cancel obsolete folder prefetch tasks when user navigates away
   */
  cancelFolderPrefetch() {
    this.pdfPrefetchQueue = this.pdfPrefetchQueue.filter((item) => item.priority === 'HIGH');
  }
}

export const backgroundPreloadService = new BackgroundPreloadService();
export default backgroundPreloadService;
