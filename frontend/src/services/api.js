import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000, // 3 minutes timeout for reliable large document uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
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

// Response interceptor to handle session expiry or suspension
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token invalid or expired
      const isAuthRoute = window.location.pathname.startsWith('/login');
      if (!isAuthRoute) {
        localStorage.removeItem('dms_token');
        localStorage.removeItem('dms_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
