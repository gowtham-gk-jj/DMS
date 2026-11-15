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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Sidebar({ onClose, isMobile = false }) {
  const { user, isAdmin, logout } = useAuth();
  const { isDark } = useTheme();

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center space-x-3 px-3 py-2.5 text-xs font-medium transition-colors select-none ${
      isActive
        ? isDark
          ? 'bg-[#f8fafc] text-[#0b0f17] font-semibold'
          : 'bg-[#111111] text-[#ffffff] font-semibold'
        : isDark
        ? 'text-[#cbd5e1] hover:bg-[#1e293b] hover:text-[#ffffff]'
        : 'text-[#111111] hover:bg-[#f0f0f0] hover:text-[#000000]'
    }`;

  return (
    <aside
      className={`flex flex-col justify-between shrink-0 select-none ${
        isMobile
          ? 'w-72 max-w-[85vw] h-full shadow-2xl z-50'
          : 'w-64 min-h-screen border-r hidden lg:flex'
      } ${
        isDark
          ? 'bg-[#0d131f] border-[#243042] text-[#f8fafc]'
          : 'bg-[#fafafa] border-[#e5e5e5] text-[#111111]'
      }`}
    >
      {/* Top Branding */}
      <div>
        <div
          className={`p-4 border-b flex items-center justify-between ${
            isDark
              ? 'bg-[#0f172a] border-[#243042]'
              : 'bg-[#ffffff] border-[#e5e5e5]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-7 h-7 flex items-center justify-center font-bold text-xs font-mono shrink-0 ${
                isDark
                  ? 'bg-[#f8fafc] text-[#0b0f17]'
                  : 'bg-[#111111] text-[#ffffff]'
              }`}
            >
              D
            </div>
            <div>
              <span
                className={`font-bold text-xs tracking-tight block leading-tight ${
                  isDark ? 'text-[#f8fafc]' : 'text-[#111111]'
                }`}
              >
                ENTERPRISE DMS
              </span>
              <span
                className={`text-[10px] block font-mono ${
                  isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                }`}
              >
                DOConCD ARCHITECTURE
              </span>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          {isMobile && (
            <button
              onClick={onClose}
              type="button"
              aria-label="Close navigation menu"
              title="Close navigation menu"
              className={`p-1.5 rounded-none transition-colors border ${
                isDark
                  ? 'text-[#cbd5e1] hover:text-[#ffffff] bg-[#1e293b] border-[#334155]'
                  : 'text-[#555555] hover:text-[#111111] bg-[#f5f5f5] border-[#cccccc]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* User Card */}
        <div
          className={`p-3 border-b ${
            isDark
              ? 'bg-[#111827] border-[#243042]'
              : 'bg-[#fafafa] border-[#e5e5e5]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {user?.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name}
                className={`w-7 h-7 rounded-none border object-cover ${
                  isDark ? 'border-[#334155]' : 'border-[#cccccc]'
                }`}
              />
            ) : (
              <div
                className={`w-7 h-7 font-bold text-xs flex items-center justify-center shrink-0 ${
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
        </div>

        {/* Navigation Sections */}
        <div className="p-2 space-y-0.5 overflow-y-auto max-h-[calc(100vh-210px)]">
          <div
            className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 mt-2 ${
              isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
            }`}
          >
            Workspace
          </div>

          <NavLink to="/dashboard" onClick={handleLinkClick} className={navLinkClass}>
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/library" onClick={handleLinkClick} className={navLinkClass}>
            <FolderTree className="w-4 h-4 shrink-0" />
            <span>Document Library</span>
          </NavLink>

          <NavLink to="/recent" onClick={handleLinkClick} className={navLinkClass}>
            <Clock className="w-4 h-4 shrink-0" />
            <span>Recent Documents</span>
          </NavLink>

          <NavLink to="/access-info" onClick={handleLinkClick} className={navLinkClass}>
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Access Information</span>
          </NavLink>

          {/* Administrator Panel Section */}
          {isAdmin && (
            <>
              <div
                className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 mt-4 ${
                  isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
                }`}
              >
                Administrator
              </div>

              <NavLink to="/admin" end onClick={handleLinkClick} className={navLinkClass}>
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Admin Overview</span>
              </NavLink>

              <NavLink to="/admin/requests" onClick={handleLinkClick} className={navLinkClass}>
                <FileCheck2 className="w-4 h-4 shrink-0" />
                <span>Access Requests</span>
              </NavLink>

              <NavLink to="/admin/users" onClick={handleLinkClick} className={navLinkClass}>
                <Users className="w-4 h-4 shrink-0" />
                <span>User Management</span>
              </NavLink>

              <NavLink to="/admin/audit-logs" onClick={handleLinkClick} className={navLinkClass}>
                <ScrollText className="w-4 h-4 shrink-0" />
                <span>Audit Logs</span>
              </NavLink>

              <NavLink to="/admin/email-logs" onClick={handleLinkClick} className={navLinkClass}>
                <Mail className="w-4 h-4 shrink-0" />
                <span>Email Logs</span>
              </NavLink>

              <NavLink to="/admin/migration" onClick={handleLinkClick} className={navLinkClass}>
                <Database className="w-4 h-4 shrink-0" />
                <span>DOConCD Migration</span>
              </NavLink>
            </>
          )}

          <div
            className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 mt-4 ${
              isDark ? 'text-[#94a3b8]' : 'text-[#777777]'
            }`}
          >
            System
          </div>

          <NavLink to="/settings" onClick={handleLinkClick} className={navLinkClass}>
            <Settings className="w-4 h-4 shrink-0" />
            <span>Settings</span>
          </NavLink>
        </div>
      </div>

      {/* Bottom Footer & Logout */}
      <div
        className={`p-3 border-t ${
          isDark
            ? 'bg-[#0f172a] border-[#243042]'
            : 'bg-[#ffffff] border-[#e5e5e5]'
        }`}
      >
        <button
          onClick={() => {
            if (onClose) onClose();
            logout();
          }}
          className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
            isDark
              ? 'text-[#f8fafc] hover:bg-[#1e293b]'
              : 'text-[#111111] hover:bg-[#f0f0f0]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <LogOut
              className={`w-4 h-4 ${isDark ? 'text-[#94a3b8]' : 'text-[#777777]'}`}
            />
            <span>Sign Out</span>
          </div>
          <ChevronRight
            className={`w-3.5 h-3.5 ${isDark ? 'text-[#64748b]' : 'text-[#cccccc]'}`}
          />
        </button>
      </div>
    </aside>
  );
}
