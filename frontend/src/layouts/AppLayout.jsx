import React, { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import DocumentViewer from '../components/DocumentViewer';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function AppLayout({ breadcrumbs = [] }) {
  const [activeDocument, setActiveDocument] = useState(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('dms_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const { user, isAdmin } = useAuth();
  const { isDark } = useTheme();

  // Toggle desktop collapsed mode and remember across sessions
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('dms_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Prevent background scrolling while mobile navigation drawer is open
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileDrawerOpen]);

  // Keyboard shortcuts: Escape to close drawer, Ctrl+[ or Cmd+[ to toggle collapse
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileDrawerOpen) {
        setIsMobileDrawerOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileDrawerOpen, toggleCollapse]);

  // User permissions for active document
  const userPermissions = isAdmin
    ? { read: true, upload: true, download: true, manage: true }
    : user?.permissions || {};

  return (
    <div className="flex min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-150">
      {/* 1. Desktop Persistent Sidebar (>= 1024px) */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* 2. Mobile & Tablet Navigation Drawer (< 1024px) with Smooth Slide-in */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ${
          isMobileDrawerOpen
            ? 'pointer-events-auto visible'
            : 'pointer-events-none invisible'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Drawer"
      >
        {/* Dark transparent backdrop overlay */}
        <div
          className={`fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 ${
            isMobileDrawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-hidden="true"
        />

        {/* Slide-in Drawer Container */}
        <div
          className={`fixed inset-y-0 left-0 max-w-[85vw] w-[270px] h-full z-50 transform transition-transform duration-300 ease-in-out ${
            isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar
            isMobile={true}
            onClose={() => setIsMobileDrawerOpen(false)}
          />
        </div>
      </div>

      {/* 3. Main Application Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-main)] transition-colors duration-150">
        <Header
          breadcrumbs={breadcrumbs}
          onSelectDocument={setActiveDocument}
          onToggleMobileDrawer={() => setIsMobileDrawerOpen((prev) => !prev)}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />

        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 lg:p-8 bg-[var(--bg-main)] transition-colors duration-150">
          <div className="page-enter">
            <Outlet context={{ openDocument: setActiveDocument }} />
          </div>
        </main>
      </div>

      {/* 4. In-App Document Viewer Modal */}
      {activeDocument && (
        <DocumentViewer
          document={activeDocument}
          userPermissions={userPermissions}
          onClose={() => setActiveDocument(null)}
        />
      )}
    </div>
  );
}
