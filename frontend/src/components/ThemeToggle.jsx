import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '', showLabel = false }) {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
      className={`inline-flex items-center justify-center p-2 rounded-none transition-colors border focus:outline-none focus:ring-1 focus:ring-offset-1 select-none min-h-[38px] min-w-[38px] cursor-pointer ${
        isDark
          ? 'bg-[#1e293b] text-[#f8fafc] border-[#334155] hover:bg-[#334155] focus:ring-[#64748b]'
          : 'bg-[#fafafa] text-[#111111] border-[#cccccc] hover:bg-[#f0f0f0] focus:ring-[#111111]'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-[#fbbf24] transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-[#111111] transition-transform duration-200 hover:-rotate-12" />
      )}
      {showLabel && (
        <span className="ml-2 text-xs font-medium font-mono">
          {isDark ? 'LIGHT' : 'DARK'}
        </span>
      )}
    </button>
  );
}
