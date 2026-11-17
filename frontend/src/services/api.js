
import axios from 'axios';

// Auto-detect localhost vs Production Render backend URL
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const rawBaseUrl =
  (isLocalhost ? 'http://localhost:5000/api' : null) ||
  import.meta.env.VITE_API_BASE_URL ||
  'https://dms-dab9.onrender.com/api';

const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '').endsWith('/api')
  ? rawBaseUrl.replace(/\/+$/, '')
  : `${rawBaseUrl.replace(/\/+$/, '')}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000, // 3 minutes for large document uploads
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// In-flight request deduplication map
const pendingRequests = new Map();

// Short-lived memory cache for idempotent metadata GET requests (TTL: 8 seconds)
const responseCache = new Map();
const CACHE_TTL_MS = 8000;

export const clearApiCache = () => {
  responseCache.clear();
};

// Generate cache key scoped to user token
const getCacheKey = (config) => {
  const token = localStorage.getItem('dms_token') || 'anon';
  const url = config.url || '';
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${token}:${config.method}:${url}:${params}`;
};

// Invalidate on mutations
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('dms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const method = (config.method || 'get').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      // Invalidate cache immediately on any mutation
      responseCache.clear();
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with in-flight cleanup and caching
api.interceptors.response.use(
  (response) => {
    const config = response.config;
    const method = (config.method || 'get').toLowerCase();

    // Cache safe JSON GET responses
    if (
      method === 'get' &&
      !config.skipCache &&
      config.responseType !== 'blob' &&
      config.responseType !== 'arraybuffer' &&
      response.status === 200
    ) {
      const key = getCacheKey(config);
      responseCache.set(key, {
        timestamp: Date.now(),
        data: response.data,
      });
    }

    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      const isAuthRoute =
        window.location.pathname.startsWith('/login') ||
        window.location.pathname.startsWith('/forgot-password') ||
        window.location.pathname.startsWith('/reset-password');

      if (!isAuthRoute) {
        localStorage.removeItem('dms_token');
        localStorage.removeItem('dms_user');
        responseCache.clear();
        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  }
);

// Wrap api.get with deduplication & cache check
const originalGet = api.get.bind(api);
api.get = function (url, config = {}) {
  const method = 'get';
  const fullConfig = { ...config, url, method };

  // Skip cache for binary streams, downloads, or when explicitly requested
  if (
    fullConfig.skipCache ||
    fullConfig.responseType === 'blob' ||
    fullConfig.responseType === 'arraybuffer' ||
    url.includes('/stream') ||
    url.includes('/download')
  ) {
    return originalGet(url, config);
  }

  const key = getCacheKey(fullConfig);

  // 1. Check valid memory cache
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return Promise.resolve({
      data: cached.data,
      status: 200,
      statusText: 'OK (Cache)',
      headers: {},
      config: fullConfig,
    });
  }

  // 2. In-flight request deduplication
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  const requestPromise = originalGet(url, config).finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, requestPromise);
  return requestPromise;
};

export default api;
