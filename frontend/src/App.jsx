import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import RouteSkeleton from './components/RouteSkeleton';

// Layout (eagerly loaded for frame stability)
import AppLayout from './layouts/AppLayout';

// Lazy-loaded Public Pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PendingApprovalPage = lazy(() => import('./pages/PendingApprovalPage'));

// Lazy-loaded Authenticated Pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'));
const AccessInfoPage = lazy(() => import('./pages/AccessInfoPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Lazy-loaded Admin Pages (Code-split out of general user bundle)
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'));
const AdminRequestsPage = lazy(() => import('./pages/admin/AdminRequestsPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminAuditLogsPage = lazy(() => import('./pages/admin/AdminAuditLogsPage'));
const AdminEmailLogsPage = lazy(() => import('./pages/admin/AdminEmailLogsPage'));
const AdminMigrationPage = lazy(() => import('./pages/admin/AdminMigrationPage'));

// Protected Route Guard for Approved Users
function ProtectedRoute({ children }) {
  const { user, loading, isApproved } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center text-xs font-mono text-[var(--text-muted)]">
        Verifying security credentials...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isApproved) {
    return <Navigate to="/pending-approval" replace />;
  }

  return children;
}

// Admin-only Route Guard
function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center text-xs font-mono text-[var(--text-muted)]">
        Checking administrative privileges...
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  const googleClientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    '322912580416-k1t1hig8qhe6bk4c84stussecpq484fr.apps.googleusercontent.com';

  return (
    <ThemeProvider>
      <GoogleOAuthProvider clientId={googleClientId}>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteSkeleton />}>
              <Routes>
                {/* Public Auth Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
                <Route path="/pending-approval" element={<PendingApprovalPage />} />
                <Route path="/access-status" element={<PendingApprovalPage />} />
                <Route path="/request-access" element={<Navigate to="/pending-approval" replace />} />
                <Route path="/rejected" element={<PendingApprovalPage />} />

                {/* Authenticated Application Layout */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="library" element={<LibraryPage />} />
                  <Route path="library/:folderId" element={<LibraryPage />} />
                  <Route path="recent" element={<DashboardPage />} />
                  <Route path="search" element={<SearchResultsPage />} />
                  <Route path="access-info" element={<AccessInfoPage />} />
                  <Route path="settings" element={<SettingsPage />} />

                  {/* Admin Routes */}
                  <Route
                    path="admin"
                    element={
                      <AdminRoute>
                        <AdminOverviewPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="admin/requests"
                    element={
                      <AdminRoute>
                        <AdminRequestsPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="admin/users"
                    element={
                      <AdminRoute>
                        <AdminUsersPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="admin/audit-logs"
                    element={
                      <AdminRoute>
                        <AdminAuditLogsPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="admin/email-logs"
                    element={
                      <AdminRoute>
                        <AdminEmailLogsPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="admin/migration"
                    element={
                      <AdminRoute>
                        <AdminMigrationPage />
                      </AdminRoute>
                    }
                  />
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  </ThemeProvider>
);
}
