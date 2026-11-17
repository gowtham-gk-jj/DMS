import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('dms_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('dms_token') || null);
  // Initial loading is only true if we have a token that needs validation and no cached optimistic user
  const [loading, setLoading] = useState(() => {
    const hasToken = !!localStorage.getItem('dms_token');
    const hasUser = !!localStorage.getItem('dms_user');
    return hasToken && !hasUser;
  });
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Securely revalidate user session and live permissions on mount
  useEffect(() => {
    let isMounted = true;
    const validateCurrentUser = async () => {
      const currentToken = localStorage.getItem('dms_token');
      if (!currentToken) {
        if (isMounted) setLoading(false);
        return;
      }

      setIsRevalidating(true);
      try {
        const res = await api.get('/auth/me', { skipCache: true });
        if (res.data?.success && isMounted) {
          setUser(res.data.user);
          localStorage.setItem('dms_user', JSON.stringify(res.data.user));
        }
      } catch (err) {
        console.error('Session validation error:', err);
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          if (isMounted) {
            setUser(null);
            setToken(null);
            localStorage.removeItem('dms_token');
            localStorage.removeItem('dms_user');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setIsRevalidating(false);
        }
      }
    };

    validateCurrentUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAuthSuccess = (token, userData) => {
    setToken(token);
    setUser(userData);
    localStorage.setItem('dms_token', token);
    localStorage.setItem('dms_user', JSON.stringify(userData));
  };

  const loginWithGoogle = async (credential) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await api.post('/auth/google', { credential });
      if (res.data.success) {
        handleAuthSuccess(res.data.token, res.data.user);
        return res.data.user;
      }
      throw new Error(res.data.message || 'Google authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loginWithEmail = async (email, password) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        handleAuthSuccess(res.data.token, res.data.user);
        return res.data.user;
      }
      throw new Error(res.data.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.success) {
        setUser(res.data.user);
        localStorage.setItem('dms_user', JSON.stringify(res.data.user));
        return res.data.user;
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
    return null;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('dms_token');
      localStorage.removeItem('dms_user');
      window.location.href = '/login';
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  const isApproved = user?.status === 'APPROVED' || isAdmin;
  const isPendingRequest = user?.status === 'PENDING_REQUEST';
  const isPending = user?.status === 'PENDING';
  const isRejected = user?.status === 'REJECTED';
  const isSuspended = user?.status === 'SUSPENDED';

  const value = {
    user,
    token,
    loading,
    isRevalidating,
    isSubmitting,
    isAdmin,
    isApproved,
    isPendingRequest,
    isPending,
    isRejected,
    isSuspended,
    loginWithGoogle,
    loginWithEmail,
    refreshUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
