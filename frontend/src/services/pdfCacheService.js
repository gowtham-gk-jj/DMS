/**
 * Enterprise DMS — Persistent Client-Side PDF Byte-Range & Metadata Cache
 * Uses IndexedDB for bounded, version-aware binary storage with LRU eviction.
 * Strict Security: Never stores tokens, passwords, or session secrets.
 */

const DB_NAME = 'DMS_PDF_CACHE_V1';
const DB_VERSION = 1;
const STORE_RANGES = 'pdf_ranges';
const STORE_METADATA = 'doc_metadata';

// Configurable cache ceiling (default: 100 MB)
export const MAX_CACHE_SIZE_BYTES = 100 * 1024 * 1024;

let dbPromise = null;
let isIndexedDbSupported = typeof window !== 'undefined' && 'indexedDB' in window;

/**
 * Initialize or retrieve the active IndexedDB connection
 */
export function getDb() {
  if (!isIndexedDbSupported) {
    return Promise.resolve(null);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. PDF Byte Ranges Object Store
        if (!db.objectStoreNames.contains(STORE_RANGES)) {
          const rangeStore = db.createObjectStore(STORE_RANGES, { keyPath: 'id' });
          rangeStore.createIndex('docId_version', ['docId', 'version'], { unique: false });
          rangeStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          rangeStore.createIndex('size', 'size', { unique: false });
        }

        // 2. Document Preview Metadata Object Store
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          const metaStore = db.createObjectStore(STORE_METADATA, { keyPath: 'docId' });
          metaStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (err) => {
        console.warn('[PdfCache] IndexedDB open failed, falling back to network:', err);
        isIndexedDbSupported = false;
        resolve(null);
      };
    } catch (e) {
      console.warn('[PdfCache] IndexedDB unavailable (e.g. private mode):', e);
      isIndexedDbSupported = false;
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Compute composite key for range chunks
 */
function makeRangeKey(docId, version, start, end) {
  const safeVer = version || 'v1';
  return `${docId}:${safeVer}:${start}:${end}`;
}

/**
 * Retrieve cached byte range chunk
 */
export async function getByteRange(docId, version, start, end) {
  const db = await getDb();
  if (!db || !docId) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RANGES, 'readwrite');
      const store = tx.objectStore(STORE_RANGES);
      const key = makeRangeKey(docId, version, start, end);
      const req = store.get(key);

      req.onsuccess = () => {
        const record = req.result;
        if (!record || !record.data) {
          resolve(null);
          return;
        }

        // Update LRU access timestamp
        record.lastAccessed = Date.now();
        record.accessCount = (record.accessCount || 1) + 1;
        try {
          store.put(record);
        } catch {}

        resolve(record.data);
      };

      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Store byte range chunk with LRU space enforcement
 */
export async function putByteRange(docId, version, start, end, totalSize, arrayBuffer) {
  const db = await getDb();
  if (!db || !docId || !arrayBuffer) return false;

  const size = arrayBuffer.byteLength;
  const key = makeRangeKey(docId, version, start, end);
  const safeVer = version || 'v1';

  try {
    // Check and evict if needed
    await enforceLruLimit(size);

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_RANGES, 'readwrite');
      const store = tx.objectStore(STORE_RANGES);

      const record = {
        id: key,
        docId: String(docId),
        version: String(safeVer),
        start: Number(start),
        end: Number(end),
        totalSize: Number(totalSize || size),
        data: arrayBuffer,
        size,
        lastAccessed: Date.now(),
        accessCount: 1,
      };

      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => {
        if (e.target?.error?.name === 'QuotaExceededError') {
          console.warn('[PdfCache] Quota exceeded. Evicting LRU entries...');
          evictLru(size * 2).catch(() => {});
        }
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[PdfCache] putByteRange failed:', err);
    return false;
  }
}

/**
 * Check if the complete document buffer is available
 */
export async function getCompleteBuffer(docId, version) {
  const db = await getDb();
  if (!db || !docId) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RANGES, 'readwrite');
      const store = tx.objectStore(STORE_RANGES);
      const safeVer = version || 'v1';
      const index = store.index('docId_version');
      const req = index.getAll([String(docId), String(safeVer)]);

      req.onsuccess = () => {
        const ranges = req.result;
        if (!ranges || ranges.length === 0) {
          resolve(null);
          return;
        }

        // If a single full buffer range exists
        const fullRange = ranges.find((r) => r.start === 0 && r.end >= r.totalSize - 1);
        if (fullRange && fullRange.data) {
          fullRange.lastAccessed = Date.now();
          fullRange.accessCount = (fullRange.accessCount || 1) + 1;
          try {
            store.put(fullRange);
          } catch {}
          resolve(fullRange.data);
          return;
        }

        resolve(null);
      };

      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Store the complete document buffer
 */
export async function putCompleteBuffer(docId, version, totalSize, arrayBuffer) {
  if (!arrayBuffer) return false;
  const size = arrayBuffer.byteLength;
  const end = Math.max(0, (totalSize || size) - 1);
  return putByteRange(docId, version, 0, end, totalSize || size, arrayBuffer);
}

/**
 * Retrieve cached document metadata
 */
export async function getDocMetadata(docId) {
  const db = await getDb();
  if (!db || !docId) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_METADATA, 'readonly');
      const store = tx.objectStore(STORE_METADATA);
      const req = store.get(String(docId));

      req.onsuccess = () => {
        const record = req.result;
        if (!record) {
          resolve(null);
          return;
        }
        resolve(record);
      };

      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Store document metadata
 */
export async function putDocMetadata(docId, metadata) {
  const db = await getDb();
  if (!db || !docId || !metadata) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_METADATA, 'readwrite');
      const store = tx.objectStore(STORE_METADATA);
      const record = {
        ...metadata,
        docId: String(docId),
        lastAccessed: Date.now(),
        cachedAt: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Calculate total byte size of cached ranges
 */
export async function getTotalCacheSizeBytes() {
  const db = await getDb();
  if (!db) return 0;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RANGES, 'readonly');
      const store = tx.objectStore(STORE_RANGES);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = req.result || [];
        const total = items.reduce((acc, curr) => acc + (curr.size || 0), 0);
        resolve(total);
      };

      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

/**
 * Enforce configurable LRU cache limit
 */
async function enforceLruLimit(incomingBytes = 0) {
  const currentTotal = await getTotalCacheSizeBytes();
  if (currentTotal + incomingBytes > MAX_CACHE_SIZE_BYTES) {
    const bytesToFree = currentTotal + incomingBytes - MAX_CACHE_SIZE_BYTES + 5 * 1024 * 1024; // Free extra 5MB headroom
    await evictLru(bytesToFree);
  }
}

/**
 * Evict oldest entries until targetFreeBytes freed
 */
export async function evictLru(targetFreeBytes) {
  const db = await getDb();
  if (!db || targetFreeBytes <= 0) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RANGES, 'readwrite');
      const store = tx.objectStore(STORE_RANGES);
      const index = store.index('lastAccessed');
      const req = index.openCursor(null, 'next'); // Oldest first

      let freedBytes = 0;

      req.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor || freedBytes >= targetFreeBytes) {
          resolve();
          return;
        }

        const record = cursor.value;
        freedBytes += record.size || 0;
        cursor.delete();
        cursor.continue();
      };

      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Clear all cached ranges and metadata (called on logout or account switch)
 */
export async function clearUserCache() {
  const db = await getDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_RANGES, STORE_METADATA], 'readwrite');
      tx.objectStore(STORE_RANGES).clear();
      tx.objectStore(STORE_METADATA).clear();
      tx.oncomplete = () => {
        console.log('[PdfCache] Client persistent cache cleared.');
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export default {
  getDb,
  getByteRange,
  putByteRange,
  getCompleteBuffer,
  putCompleteBuffer,
  getDocMetadata,
  putDocMetadata,
  getTotalCacheSizeBytes,
  evictLru,
  clearUserCache,
  MAX_CACHE_SIZE_BYTES,
};
