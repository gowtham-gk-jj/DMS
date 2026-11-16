
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

// Attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('dms_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle authentication errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthRoute =
        window.location.pathname.startsWith('/login') ||
        window.location.pathname.startsWith('/forgot-password') ||
        window.location.pathname.startsWith('/reset-password');

      if (!isAuthRoute) {
        localStorage.removeItem('dms_token');
        localStorage.removeItem('dms_user');

        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
