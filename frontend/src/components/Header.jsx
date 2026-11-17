import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import GlobalSearch from './GlobalSearch';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import backgroundPreloadService, { PRELOAD_STATE } from '../services/backgroundPreloadService';

export default function Header({
  breadcrumbs = [],
  onSelectDocument,
  onToggleMobileDrawer,
  isCollapsed = false,
  onToggleCollapse,
}) {
  const { user, isAdmin } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();

  const [preloadStatus, setPreloadStatus] = useState({ state: PRELOAD_STATE.IDLE, message: '' });

  useEffect(() => {
    const unsubscribe = backgroundPreloadService.subscribe((state, message) => {
      setPreloadStatus({ state, message });
    });
    return unsubscribe;
  }, []);

  return (
    <header className="h-14 border-b border-[var(--border-color)] px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-40 select-none bg-[var(--bg-header)] text-[var(--text-primary)] transition-colors duration-150">
      {/* Left: Mobile Hamburger & Breadcrumbs */}
      <div className="flex items-center space-x-2 min-w-0 shrink">
        {/* Mobile Hamburger Menu Button (< lg) */}
        <button
          type="button"
          onClick={onToggleMobileDrawer}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Desktop Sidebar Toggle Button (>= lg) */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar (Ctrl+[)' : 'Collapse sidebar (Ctrl+[)'}
            className="hidden lg:flex p-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer shrink-0 items-center justify-center"
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}

        {/* Breadcrumb Navigation - hidden on mobile (< md) to give search maximum space */}
        <nav
          aria-label="Breadcrumb"
          className="hidden md:flex items-center space-x-1.5 text-xs min-w-0 shrink text-[var(--text-secondary)]"
        >
          <Link
            to="/dashboard"
            aria-label="Dashboard Home"
            className="flex items-center space-x-1 shrink-0 transition-colors hover:text-[var(--text-primary)]"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden md:inline font-medium">Home</span>
          </Link>

          {breadcrumbs.length > 0 ? (
            breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.id || index}>
                <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[var(--border-strong)]" />
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-semibold truncate max-w-[100px] sm:max-w-[160px] text-[var(--text-primary)]">
                    {crumb.name}
                  </span>
                ) : (
                  <Link
                    to={`/library/${crumb.id}`}
                    className="truncate max-w-[80px] sm:max-w-[140px] transition-colors hover:text-[var(--text-primary)]"
                  >
                    {crumb.name}
                  </Link>
                )}
              </React.Fragment>
            ))
          ) : (
            <>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[var(--border-strong)]" />
              <span className="font-semibold capitalize truncate max-w-[110px] sm:max-w-none text-[var(--text-primary)]">
                {location.pathname.replace(/^\//, '').replace(/\//g, ' / ') || 'Dashboard'}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Center: Global Search Bar */}
      <div className="flex-1 max-w-xl mx-1 sm:mx-2 min-w-0">
        <GlobalSearch onSelectDocument={onSelectDocument} />
      </div>

      {/* Right: Theme Toggle, Status indicators & User Info */}
      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 text-xs">
        {/* Theme Toggle Button (Light / Dark) */}
        <ThemeToggle />

        {/* Workspace Preload Status Pill */}
        {preloadStatus.message && (
          <div
            className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 text-[11px] border rounded-md font-mono bg-[var(--bg-elevated)] border-[var(--border-color)] text-[var(--text-secondary)] transition-all animate-fadeIn"
            title={preloadStatus.message}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                preloadStatus.state === PRELOAD_STATE.PREPARING
                  ? 'bg-amber-400 animate-pulse'
                  : preloadStatus.state === PRELOAD_STATE.OFFLINE
                  ? 'bg-red-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span className="truncate max-w-[140px]">{preloadStatus.message}</span>
          </div>
        )}

        {/* System Status Pill (Desktop only) */}
        <div className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1 text-[11px] border rounded-md font-mono bg-[var(--bg-elevated)] border-[var(--border-color)] text-[var(--text-secondary)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
          <span>Atlas Cloud</span>
        </div>

        {/* User Role Badge */}
        <div className="flex items-center space-x-2 border-l border-[var(--border-color)] pl-2 sm:pl-3">
          <div className="text-right hidden sm:block">
            <div className="font-semibold text-xs leading-tight truncate max-w-[100px] md:max-w-[130px] text-[var(--text-primary)]">
              {user?.name}
            </div>
            <div className="text-[10px] uppercase font-mono text-[var(--text-muted)] tracking-wider">
              {isAdmin ? 'ADMINISTRATOR' : 'AUTHORIZED'}
            </div>
          </div>

          {/* Compact User Initial on Mobile */}
          <div
            className={`sm:hidden w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs border shrink-0 ${
              isAdmin
                ? 'bg-[var(--primary-subtle)] text-[var(--primary-blue)] border-[var(--primary-border)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-color)]'
            }`}
          >
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}
