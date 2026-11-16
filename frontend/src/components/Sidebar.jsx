import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderTree,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Settings,
  LogOut,
  Users,
  FileCheck2,
  ScrollText,
  Mail,
  ChevronRight,
  Database,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Navigation Item Component
function NavItem({
  to,
  end = false,
  icon: Icon,
  label,
  isMobile,
  isCollapsed,
  onClose,
}) {
  const location = useLocation();

  // Active check supporting exact routes and nested subpaths (e.g. /library/:folderId)
  const isActive = end
    ? location.pathname === to
    : location.pathname === to || location.pathname.startsWith(`${to}/`);

  const handleClick = () => {
    if (onClose) onClose();
  };

  return (
    <div className="relative group px-2 py-0.5">
      <NavLink
        to={to}
        end={end}
        onClick={handleClick}
        title={isCollapsed && !isMobile ? label : undefined}
        className={`flex items-center text-[13px] font-medium transition-all duration-150 select-none rounded-md relative ${
          isMobile
            ? 'min-h-[44px] px-3 py-2.5 space-x-3'
            : isCollapsed
            ? 'justify-center min-h-[40px] h-[40px] px-2'
            : 'min-h-[38px] h-[38px] px-3 space-x-3'
        } ${
          isActive
            ? 'active bg-[var(--primary-subtle)] text-[var(--primary-blue)] font-semibold'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
        }`}
      >
        {/* Active Left Indicator Bar */}
        {isActive && !isCollapsed && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[var(--primary-blue)]" />
        )}

        <div
          className={`w-[18px] h-[18px] shrink-0 flex items-center justify-center transition-colors ${
            isActive
              ? 'text-[var(--primary-blue)]'
              : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
          }`}
        >
          <Icon className="w-[18px] h-[18px]" />
        </div>

        {/* Navigation Label: Visible on mobile or expanded desktop */}
        {(!isCollapsed || isMobile) && (
          <span className="truncate flex-1 tracking-normal font-sans">
            {label}
          </span>
        )}
      </NavLink>

      {/* Floating Tooltip in Desktop Collapsed Mode */}
      {isCollapsed && !isMobile && (
        <div
          role="tooltip"
          className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 rounded-md bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-color)]"
        >
          {label}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  onClose,
  isMobile = false,
  isCollapsed = false,
  onToggleCollapse,
}) {
  const { user, isAdmin, logout } = useAuth();
  const { isDark } = useTheme();

  const renderNavItem = (to, icon, label, end = false) => (
    <NavItem
      key={to}
      to={to}
      end={end}
      icon={icon}
      label={label}
      isMobile={isMobile}
      isCollapsed={isCollapsed}
      onClose={onClose}
    />
  );

  return (
    <aside
      className={`flex flex-col shrink-0 select-none transition-all duration-200 border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] text-[var(--text-primary)] ${
        isMobile
          ? 'w-[270px] max-w-[85vw] h-full shadow-2xl z-50'
          : isCollapsed
          ? 'w-[68px] h-screen sticky top-0 hidden lg:flex'
          : 'w-64 h-screen sticky top-0 hidden lg:flex'
      }`}
      aria-label="Enterprise DMS Sidebar Navigation"
    >
      {/* 1. TOP BRAND SECTION */}
      <div
        className={`border-b border-[var(--border-color)] shrink-0 bg-[var(--bg-sidebar)] ${
          isCollapsed && !isMobile ? 'p-2.5 flex flex-col items-center space-y-2' : 'p-3.5 px-4 flex items-center justify-between'
        }`}
      >
        {isCollapsed && !isMobile ? (
          <>
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs font-mono shrink-0 bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]"
              title="Enterprise Document Management System"
            >
              ED
            </div>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Expand sidebar"
                title="Expand sidebar (Ctrl+[)"
                className="w-7 h-7 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex items-center justify-center"
              >
                <PanelLeftOpen className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs font-mono shrink-0 bg-[var(--primary-subtle)] text-[var(--primary-blue)] border border-[var(--primary-border)]">
                ED
              </div>
              <div className="min-w-0">
                <span className="font-bold text-[13px] tracking-tight block leading-tight text-[var(--text-primary)] truncate font-sans">
                  ENTERPRISE DMS
                </span>
                <span className="text-[10px] block font-mono tracking-wider text-[var(--text-muted)] truncate uppercase">
                  INDUSTRIAL SAAS
                </span>
              </div>
            </div>

            {/* Mobile Close Button (Touch Target >= 44px) */}
            {isMobile && (
              <button
                onClick={onClose}
                type="button"
                aria-label="Close navigation menu"
                title="Close navigation menu"
                className="min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border-color)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Desktop Collapse Toggle Control */}
            {!isMobile && onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                title="Collapse sidebar (Ctrl+[)"
                className="w-7 h-7 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer hidden lg:flex items-center justify-center"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* 2. USER PROFILE SECTION */}
      <div
        className={`border-b border-[var(--border-color)] shrink-0 bg-[var(--bg-sidebar)] ${
          isCollapsed && !isMobile ? 'p-2 flex justify-center' : 'p-2.5 px-3.5'
        }`}
      >
        {isCollapsed && !isMobile ? (
          <div className="relative group">
            {user?.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name}
                className="w-7 h-7 rounded-md border border-[var(--border-color)] object-cover cursor-default"
              />
            ) : (
              <div className="w-7 h-7 rounded-md font-bold text-xs flex items-center justify-center shrink-0 cursor-default bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-color)]">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            {/* Tooltip with user info */}
            <div
              role="tooltip"
              className="absolute left-full top-1/2 -translate-y-1/2 ml-2 p-2.5 text-xs font-normal whitespace-nowrap shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 rounded-md bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-color)]"
            >
              <div className="font-semibold">{user?.name}</div>
              <div className="text-[11px] text-[var(--text-secondary)] font-mono mt-0.5">
                {user?.role || 'USER'} • {user?.organization || 'Engineering'}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2.5 min-w-0">
            {user?.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name}
                className="w-7 h-7 rounded-md border border-[var(--border-color)] object-cover shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-md font-bold text-xs flex items-center justify-center shrink-0 bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-color)]">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="truncate flex-1 min-w-0">
              <div className="font-semibold text-xs text-[var(--text-primary)] truncate leading-tight">
                {user?.name}
              </div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span
                  className={`text-[10px] font-mono px-1 py-0.2 border rounded-xs uppercase font-semibold shrink-0 ${
                    isAdmin
                      ? 'bg-[var(--primary-subtle)] text-[var(--primary-blue)] border-[var(--primary-border)]'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)]'
                  }`}
                >
                  {user?.role || 'USER'}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] truncate font-sans">
                  {user?.organization || 'Engineering'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. INDEPENDENTLY SCROLLING NAVIGATION CONTAINER */}
      <nav
        className="flex-1 overflow-y-auto min-h-0 py-2 space-y-0.5"
        aria-label="Main Navigation"
      >
        {/* GROUP 1: WORKSPACE */}
        {(!isCollapsed || isMobile) ? (
          <div className="text-[10px] font-bold font-mono uppercase tracking-wider text-[var(--text-muted)] px-3.5 pt-2 pb-1">
            WORKSPACE
          </div>
        ) : (
          <div className="my-1 border-t border-transparent" />
        )}

        {renderNavItem('/dashboard', LayoutDashboard, 'Dashboard')}
        {renderNavItem('/library', FolderTree, 'Document Library')}
        {renderNavItem('/recent', Clock, 'Recent Documents')}
        {renderNavItem('/access-info', ShieldCheck, 'Access Information')}

        {/* GROUP 2: ADMINISTRATION (Strictly visible only if isAdmin) */}
        {isAdmin && (
          <>
            {(!isCollapsed || isMobile) ? (
              <div className="text-[10px] font-bold font-mono uppercase tracking-wider text-[var(--text-muted)] px-3.5 pt-3 pb-1">
                ADMINISTRATION
              </div>
            ) : (
              <div className="my-1.5 border-t border-[var(--border-color)]" />
            )}

            {renderNavItem('/admin', ShieldAlert, 'Admin Overview', true)}
            {renderNavItem('/admin/requests', FileCheck2, 'Access Requests')}
            {renderNavItem('/admin/users', Users, 'User Management')}
            {renderNavItem('/admin/audit-logs', ScrollText, 'Audit Logs')}
            {renderNavItem('/admin/email-logs', Mail, 'Email Logs')}
            {renderNavItem('/admin/migration', Database, 'DOConCD Migration')}
          </>
        )}

        {/* GROUP 3: SYSTEM */}
        {(!isCollapsed || isMobile) ? (
          <div className="text-[10px] font-bold font-mono uppercase tracking-wider text-[var(--text-muted)] px-3.5 pt-3 pb-1">
            SYSTEM
          </div>
        ) : (
          <div className="my-1.5 border-t border-[var(--border-color)]" />
        )}

        {renderNavItem('/settings', Settings, 'Settings')}
      </nav>

      {/* 4. BOTTOM FOOTER & SIGN OUT (ANCHORED AT BOTTOM) */}
      <div className="p-2 border-t border-[var(--border-color)] shrink-0 mt-auto bg-[var(--bg-sidebar)]">
        <div className="relative group">
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              logout();
            }}
            title={isCollapsed && !isMobile ? 'Sign Out' : undefined}
            className={`w-full flex items-center transition-colors duration-150 cursor-pointer rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] ${
              isMobile
                ? 'min-h-[44px] px-3.5 py-2.5 justify-between text-xs font-medium'
                : isCollapsed
                ? 'min-h-[40px] h-[40px] p-2 justify-center text-xs'
                : 'min-h-[38px] h-[38px] px-3 py-2 justify-between text-xs font-medium'
            }`}
          >
            <div className="flex items-center space-x-3">
              <LogOut className="w-[18px] h-[18px] shrink-0 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]" />
              {(!isCollapsed || isMobile) && (
                <span className="font-sans text-[13px]">Sign Out</span>
              )}
            </div>

            {(!isCollapsed || isMobile) && (
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" />
            )}
          </button>

          {/* Tooltip in collapsed mode */}
          {isCollapsed && !isMobile && (
            <div
              role="tooltip"
              className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 rounded-md bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-color)]"
            >
              Sign Out
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
