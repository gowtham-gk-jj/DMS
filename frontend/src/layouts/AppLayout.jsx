import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import DocumentViewer from '../components/DocumentViewer';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function AppLayout({ breadcrumbs = [] }) {
  const [activeDocument, setActiveDocument] = useState(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  const { isDark } = useTheme();

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

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileDrawerOpen) {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileDrawerOpen]);

  // User permissions for active document
  const userPermissions = isAdmin
    ? { read: true, upload: true, download: true, manage: true }
    : user?.permissions || {};

  return (
    <div
      className={`flex min-h-screen transition-colors duration-150 ${
        isDark ? 'bg-[#0b0f17] text-[#f8fafc]' : 'bg-[#ffffff] text-[#111111]'
      }`}
    >
      {/* Desktop Persistent Sidebar (>= 1024px) */}
      <Sidebar />

      {/* Mobile & Tablet Navigation Drawer (< 1024px) */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="fixed inset-y-0 left-0 max-w-full flex z-50">
            <Sidebar isMobile={true} onClose={() => setIsMobileDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-colors duration-150 ${
          isDark ? 'bg-[#0b0f17]' : 'bg-[#ffffff]'
        }`}
      >
        <Header
          breadcrumbs={breadcrumbs}
          onSelectDocument={setActiveDocument}
          onToggleMobileDrawer={() => setIsMobileDrawerOpen((prev) => !prev)}
        />

        <main
          className={`flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 transition-colors duration-150 ${
            isDark ? 'bg-[#0b0f17]' : 'bg-[#ffffff]'
          }`}
        >
          <Outlet context={{ openDocument: setActiveDocument }} />
        </main>
      </div>

      {/* In-App Document Viewer Modal */}
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
