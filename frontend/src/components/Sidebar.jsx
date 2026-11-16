import React from 'react';
import { NavLink } from 'react-router-dom';
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

// Pure NavItem component declared outside of Sidebar to prevent recreation on render
function NavItem({
  to,
  end = false,
  icon: Icon,
  label,
  isMobile,
  isCollapsed,
  isDark,
  onClose,
}) {
  const handleClick = () => {
    if (onClose) onClose();
  };

  return (
    <div className="relative group">
      <NavLink
        to={to}
        end={end}
        onClick={handleClick}
        title={isCollapsed && !isMobile ? label : undefined}
        className={({ isActive }) =>
          `flex items-center text-xs font-medium transition-all duration-150 select-none border-l-2 ${
            isMobile
              ? 'min-h-[44px] px-3.5 py-2.5 space-x-3'
              : isCollapsed
              ? 'justify-center min-h-[42px] px-2 py-2.5'
              : 'min-h-[40px] px-3 py-2 space-x-3'
          } ${
            isActive
              ? isDark
                ? 'bg-[#1e293b] text-[#60a5fa] font-semibold border-[#60a5fa]'
                : 'bg-[#f1f5f9] text-[#0f172a] font-semibold border-[#0f172a]'
              : isDark
              ? 'text-[#94a3b8] hover:bg-[#162032] hover:text-[#f8fafc] border-transparent'
              : 'text-[#475569] hover:bg-[#f8fafc] hover:text-[#111111] border-transparent'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <div
              className={`w-5 shrink-0 flex items-center justify-center ${
                isActive
                  ? isDark
                    ? 'text-[#60a5fa]'
                    : 'text-[#0f172a]'
                  : isDark
                  ? 'text-[#94a3b8] group-hover:text-[#f8fafc]'
                  : 'text-[#64748b] group-hover:text-[#111111]'
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>

            {/* Label: Shown on mobile or expanded desktop */}
            {(!isCollapsed || isMobile) && (
              <span className="truncate flex-1 tracking-normal font-sans">
                {label}
              </span>
            )}
          </>
        )}
      </NavLink>

      {/* Floating Tooltip in desktop collapsed mode */}
      {isCollapsed && !isMobile && (
        <div
          role="tooltip"
          className={`absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 border ${
            isDark
              ? 'bg-[#0f172a] text-[#f8fafc] border-[#334155]'
              : 'bg-[#ffffff] text-[#111111] border-[#cccccc]'
          }`}
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
      isDark={isDark}
      onClose={onClose}
    />
  );

  return (
    <aside
      className={`flex flex-col shrink-0 select-none transition-all duration-200 ${
        isMobile
          ? 'w-72 max-w-[85vw] h-full shadow-2xl z-50'
          : isCollapsed
          ? 'w-[68px] h-screen sticky top-0 border-r hidden lg:flex'
          : 'w-64 h-screen sticky top-0 border-r hidden lg:flex'
      } ${
        isDark
          ? 'bg-[#0d131f] border-[#243042] text-[#f8fafc]'
          : 'bg-[#fafafa] border-[#e5e5e5] text-[#111111]'
      }`}
      aria-label="Sidebar Navigation"
    >
      {/* 1. TOP BRANDING HEADER */}
      <div
        className={`p-3.5 border-b shrink-0 flex items-center ${
          isCollapsed && !isMobile ? 'justify-center' : 'justify-between'
        } ${
          isDark
            ? 'bg-[#0f172a] border-[#243042]'
            : 'bg-[#ffffff] border-[#e5e5e5]'
        }`}
      >
        {isCollapsed && !isMobile ? (
          <div className="flex flex-col items-center space-y-2">
            <div
              className={`w-8 h-8 flex items-center justify-center font-bold text-sm font-mono shrink-0 shadow-xs ${
                isDark
                  ? 'bg-[#f8fafc] text-[#0b0f17]'
                  : 'bg-[#111111] text-[#ffffff]'
              }`}
              title="Enterprise DMS"
            >
              D
            </div>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className={`p-1 border transition-colors cursor-pointer flex items-center justify-center ${
                  isDark
                    ? 'text-[#94a3b8] hover:text-[#f8fafc] bg-[#1e293b] border-[#334155] hover:bg-[#334155]'
                    : 'text-[#64748b] hover:text-[#111111] bg-[#f5f5f5] border-[#cccccc] hover:bg-[#e5e5e5]'
                }`}
              >
                <PanelLeftOpen className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center space-x-2.5 min-w-0">
              <div
                className={`w-7 h-7 flex items-center justify-center font-bold text-xs font-mono shrink-0 ${
                  isDark
                    ? 'bg-[#f8fafc] text-[#0b0f17]'
                    : 'bg-[#111111] text-[#ffffff]'
                }`}
              >
                D
              </div>
              <div className="min-w-0">
                <span
                  className={`font-bold text-xs tracking-tight block leading-tight truncate ${
                    isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                  }`}
                >
                  ENTERPRISE DMS
                </span>
                <span
                  className={`text-[10px] block font-mono truncate ${
                    isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                  }`}
                >
                  DOConCD ARCHITECTURE
                </span>
              </div>
            </div>

            {/* Mobile Close Button (Touch target >= 44px) */}
            {isMobile && (
              <button
                onClick={onClose}
                type="button"
                aria-label="Close navigation menu"
                title="Close navigation menu"
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors border cursor-pointer ${
                  isDark
                    ? 'text-[#cbd5e1] hover:text-[#ffffff] bg-[#1e293b] border-[#334155]'
                    : 'text-[#555555] hover:text-[#111111] bg-[#f5f5f5] border-[#cccccc]'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Desktop Collapse Toggle Button */}
            {!isMobile && onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className={`p-1.5 border transition-colors cursor-pointer hidden lg:flex items-center justify-center ${
                  isDark
                    ? 'text-[#94a3b8] hover:text-[#f8fafc] bg-[#1e293b] border-[#334155] hover:bg-[#334155]'
                    : 'text-[#64748b] hover:text-[#111111] bg-[#f5f5f5] border-[#cccccc] hover:bg-[#e5e5e5]'
                }`}
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* 2. USER PROFILE CARD */}
      <div
        className={`p-3 border-b shrink-0 ${
          isCollapsed && !isMobile ? 'flex justify-center' : ''
        } ${
          isDark
            ? 'bg-[#111827] border-[#243042]'
            : 'bg-[#fafafa] border-[#e5e5e5]'
        }`}
      >
        {isCollapsed && !isMobile ? (
          <div className="relative group">
            {user?.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name}
                className={`w-8 h-8 rounded-none border object-cover cursor-default ${
                  isDark ? 'border-[#334155]' : 'border-[#cccccc]'
                }`}
              />
            ) : (
              <div
                className={`w-8 h-8 font-bold text-xs flex items-center justify-center shrink-0 cursor-default ${
                  isDark
                    ? 'bg-[#1e293b] text-[#f8fafc] border border-[#334155]'
                    : 'bg-[#e5e5e5] text-[#111111]'
                }`}
              >
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            {/* Tooltip with user info */}
            <div
              role="tooltip"
              className={`absolute left-full top-1/2 -translate-y-1/2 ml-2.5 p-2 text-xs font-normal whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 border ${
                isDark
                  ? 'bg-[#0f172a] text-[#f8fafc] border-[#334155]'
                  : 'bg-[#ffffff] text-[#111111] border-[#cccccc]'
              }`}
            >
              <div className="font-semibold">{user?.name}</div>
              <div className="text-[10px] text-[#94a3b8] font-mono mt-0.5">
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
                className={`w-8 h-8 rounded-none border object-cover shrink-0 ${
                  isDark ? 'border-[#334155]' : 'border-[#cccccc]'
                }`}
              />
            ) : (
              <div
                className={`w-8 h-8 font-bold text-xs flex items-center justify-center shrink-0 ${
                  isDark
                    ? 'bg-[#1e293b] text-[#f8fafc] border border-[#334155]'
                    : 'bg-[#e5e5e5] text-[#111111]'
                }`}
              >
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="truncate flex-1 min-w-0">
              <div
                className={`font-semibold text-xs truncate ${
                  isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                }`}
              >
                {user?.name}
              </div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span
                  className={`text-[9px] font-mono px-1 py-0.2 border uppercase font-semibold shrink-0 ${
                    isAdmin
                      ? isDark
                        ? 'bg-[#f8fafc] text-[#0b0f17] border-[#f8fafc]'
                        : 'bg-[#111111] text-[#ffffff] border-[#111111]'
                      : isDark
                      ? 'bg-[#1e293b] text-[#cbd5e1] border-[#334155]'
                      : 'bg-[#ffffff] text-[#111111] border-[#cccccc]'
                  }`}
                >
                  {user?.role || 'USER'}
                </span>
                <span
                  className={`text-[10px] truncate ${
                    isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                  }`}
                >
                  {user?.organization || 'Engineering'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. INDEPENDENTLY SCROLLING NAVIGATION CONTAINER */}
      <nav
        className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1"
        aria-label="Main Navigation"
      >
        {/* GROUP 1: WORKSPACE */}
        {(!isCollapsed || isMobile) ? (
          <div
            className={`text-[10px] font-bold font-mono uppercase tracking-wider px-3 pt-2 pb-1 ${
              isDark ? 'text-[#64748b]' : 'text-[#888888]'
            }`}
          >
            Workspace
          </div>
        ) : (
          <div className="my-1.5 border-t border-transparent" />
        )}

        {renderNavItem('/dashboard', LayoutDashboard, 'Dashboard')}
        {renderNavItem('/library', FolderTree, 'Document Library')}
        {renderNavItem('/recent', Clock, 'Recent Documents')}
        {renderNavItem('/access-info', ShieldCheck, 'Access Information')}

        {/* GROUP 2: ADMINISTRATOR (Role-based: only visible to Admin) */}
        {isAdmin && (
          <>
            {(!isCollapsed || isMobile) ? (
              <div
                className={`text-[10px] font-bold font-mono uppercase tracking-wider px-3 pt-3.5 pb-1 ${
                  isDark ? 'text-[#64748b]' : 'text-[#888888]'
                }`}
              >
                Administrator
              </div>
            ) : (
              <div
                className={`my-2 border-t ${
                  isDark ? 'border-[#1e293b]' : 'border-[#e5e5e5]'
                }`}
              />
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
          <div
            className={`text-[10px] font-bold font-mono uppercase tracking-wider px-3 pt-3.5 pb-1 ${
              isDark ? 'text-[#64748b]' : 'text-[#888888]'
            }`}
          >
            System
          </div>
        ) : (
          <div
            className={`my-2 border-t ${
              isDark ? 'border-[#1e293b]' : 'border-[#e5e5e5]'
            }`}
          />
        )}

        {renderNavItem('/settings', Settings, 'Settings')}
      </nav>

      {/* 4. BOTTOM FOOTER & SIGN OUT (ANCHORED AT BOTTOM) */}
      <div
        className={`p-2.5 border-t shrink-0 mt-auto ${
          isDark
            ? 'bg-[#0f172a] border-[#243042]'
            : 'bg-[#ffffff] border-[#e5e5e5]'
        }`}
      >
        <div className="relative group">
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              logout();
            }}
            title={isCollapsed && !isMobile ? 'Sign Out' : undefined}
            className={`w-full flex items-center transition-colors cursor-pointer ${
              isMobile
                ? 'min-h-[44px] px-3.5 py-2.5 justify-between text-xs font-medium'
                : isCollapsed
                ? 'min-h-[40px] p-2 justify-center text-xs'
                : 'min-h-[38px] px-3 py-2 justify-between text-xs font-medium'
            } ${
              isDark
                ? 'text-[#f8fafc] hover:bg-[#1e293b]'
                : 'text-[#111111] hover:bg-[#f0f0f0]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <LogOut
                className={`w-4 h-4 shrink-0 ${
                  isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                }`}
              />
              {(!isCollapsed || isMobile) && <span>Sign Out</span>}
            </div>

            {(!isCollapsed || isMobile) && (
              <ChevronRight
                className={`w-3.5 h-3.5 shrink-0 ${
                  isDark ? 'text-[#64748b]' : 'text-[#cccccc]'
                }`}
              />
            )}
          </button>

          {/* Floating Tooltip in collapsed mode */}
          {isCollapsed && !isMobile && (
            <div
              role="tooltip"
              className={`absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 border ${
                isDark
                  ? 'bg-[#0f172a] text-[#f8fafc] border-[#334155]'
                  : 'bg-[#ffffff] text-[#111111] border-[#cccccc]'
              }`}
            >
              Sign Out
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
