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
  const [loading, setLoading] = useState(true);

  // Load latest user profile on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const currentToken = localStorage.getItem('dms_token');
      if (!currentToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res.data.success) {
          setUser(res.data.user);
          localStorage.setItem('dms_user', JSON.stringify(res.data.user));
        }
      } catch (err) {
        console.error('Failed to restore user session:', err);
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          // If suspended or forbidden, update user status if available
          if (err.response.data && err.response.data.status) {
            setUser((prev) => prev ? { ...prev, status: err.response.data.status } : null);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  const handleAuthSuccess = (token, userData) => {
    setToken(token);
    setUser(userData);
    localStorage.setItem('dms_token', token);
    localStorage.setItem('dms_user', JSON.stringify(userData));
  };

  const loginWithGoogle = async (credential) => {
    const res = await api.post('/auth/google', { credential });
    if (res.data.success) {
      handleAuthSuccess(res.data.token, res.data.user);
      return res.data.user;
    }
    throw new Error(res.data.message || 'Google authentication failed');
  };

  const loginWithEmail = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.success) {
      handleAuthSuccess(res.data.token, res.data.user);
      return res.data.user;
    }
    throw new Error(res.data.message || 'Authentication failed');
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
