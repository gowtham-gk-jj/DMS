import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home, Menu } from 'lucide-react';
import GlobalSearch from './GlobalSearch';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Header({ breadcrumbs = [], onSelectDocument, onToggleMobileDrawer }) {
  const { user, isAdmin } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();

  return (
    <header
      className={`h-14 border-b px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-40 select-none transition-colors duration-150 ${
        isDark
          ? 'bg-[#0f172a] border-[#243042] text-[#f8fafc]'
          : 'bg-[#ffffff] border-[#e5e5e5] text-[#111111]'
      }`}
    >
      {/* Left: Mobile Hamburger & Breadcrumbs */}
      <div className="flex items-center space-x-2 min-w-0 shrink">
        {/* Mobile Hamburger Menu Button (< lg) */}
        <button
          type="button"
          onClick={onToggleMobileDrawer}
          aria-label="Open navigation menu"
          className={`lg:hidden p-2 rounded-none border transition-colors cursor-pointer shrink-0 min-w-[44px] min-h-[44px] sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center ${
            isDark
              ? 'bg-[#1e293b] text-[#f8fafc] border-[#334155] hover:bg-[#334155]'
              : 'bg-[#fafafa] text-[#111111] border-[#cccccc] hover:bg-[#f0f0f0]'
          }`}
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Breadcrumb Navigation - hidden on mobile (< md) to give search maximum space */}
        <nav
          aria-label="Breadcrumb"
          className={`hidden md:flex items-center space-x-1.5 text-xs min-w-0 shrink ${
            isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
          }`}
        >
          <Link
            to="/dashboard"
            aria-label="Dashboard Home"
            className={`flex items-center space-x-1 shrink-0 transition-colors ${
              isDark ? 'hover:text-[#f8fafc]' : 'hover:text-[#111111]'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Home</span>
          </Link>

          {breadcrumbs.length > 0 ? (
            breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.id || index}>
                <ChevronRight
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isDark ? 'text-[#475569]' : 'text-[#cccccc]'
                  }`}
                />
                {index === breadcrumbs.length - 1 ? (
                  <span
                    className={`font-semibold truncate max-w-[100px] sm:max-w-[160px] ${
                      isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                    }`}
                  >
                    {crumb.name}
                  </span>
                ) : (
                  <Link
                    to={`/library/${crumb.id}`}
                    className={`truncate max-w-[80px] sm:max-w-[140px] transition-colors ${
                      isDark ? 'hover:text-[#f8fafc]' : 'hover:text-[#111111]'
                    }`}
                  >
                    {crumb.name}
                  </Link>
                )}
              </React.Fragment>
            ))
          ) : (
            <>
              <ChevronRight
                className={`w-3.5 h-3.5 shrink-0 ${
                  isDark ? 'text-[#475569]' : 'text-[#cccccc]'
                }`}
              />
              <span
                className={`font-semibold capitalize truncate max-w-[110px] sm:max-w-none ${
                  isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                }`}
              >
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

        {/* System Status Pill (Desktop only) */}
        <div
          className={`hidden xl:flex items-center space-x-1.5 px-2.5 py-1 text-[11px] border font-mono ${
            isDark
              ? 'bg-[#111827] border-[#334155] text-[#cbd5e1]'
              : 'bg-[#fafafa] border-[#e5e5e5] text-[#555555]'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${isDark ? 'bg-[#3b82f6]' : 'bg-[#111111]'}`}
          ></span>
          <span>Atlas Cloud</span>
        </div>

        {/* User Role Badge */}
        <div
          className={`flex items-center space-x-2 border-l pl-2 sm:pl-3 ${
            isDark ? 'border-[#243042]' : 'border-[#e5e5e5]'
          }`}
        >
          <div className="text-right hidden sm:block">
            <div
              className={`font-semibold text-xs leading-tight truncate max-w-[100px] md:max-w-[130px] ${
                isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
              }`}
            >
              {user?.name}
            </div>
            <div
              className={`text-[10px] uppercase font-mono ${
                isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
              }`}
            >
              {isAdmin ? 'ADMINISTRATOR' : 'AUTHORIZED'}
            </div>
          </div>

          {/* Compact User Initial on Mobile */}
          <div
            className={`sm:hidden w-8 h-8 flex items-center justify-center font-bold text-xs border shrink-0 ${
              isAdmin
                ? isDark
                  ? 'bg-[#f8fafc] text-[#0b0f17] border-[#f8fafc]'
                  : 'bg-[#111111] text-[#ffffff] border-[#111111]'
                : isDark
                ? 'bg-[#1e293b] text-[#f8fafc] border-[#334155]'
                : 'bg-[#fafafa] text-[#111111] border-[#cccccc]'
            }`}
          >
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}
