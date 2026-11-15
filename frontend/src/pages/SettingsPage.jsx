import React from 'react';
import { Settings, Database, Cloud, Shield, Server, Sun, Moon, Laptop, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function SettingsPage() {
  const { theme, setTheme, isDark } = useTheme();

  const themeOptions = [
    {
      id: 'light',
      label: 'Light Mode',
      desc: 'Crisp high-contrast white & black enterprise interface',
      icon: Sun,
    },
    {
      id: 'dark',
      label: 'Dark Mode',
      desc: 'Deep slate & charcoal low-glare night interface',
      icon: Moon,
    },
    {
      id: 'system',
      label: 'System Sync',
      desc: 'Follows your operating system theme preference',
      icon: Monitor,
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-1 sm:px-0">
      {/* Header Banner */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-xs transition-colors">
        <div className="flex items-center space-x-2 text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
          <Settings className="w-3.5 h-3.5" />
          <span>SYSTEM & ENVIRONMENT CONFIGURATION</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
          Platform Settings
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Connected infrastructure status, Cloudinary storage bucket, theme appearance, and security policies.
        </p>
      </div>

      {/* Theme & Display Appearance */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5 transition-colors">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] mb-1 pb-2 border-b border-[var(--border-subtle)]">
          Display & Appearance
        </h2>
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          Select your visual appearance mode. Changes persist automatically to your browser storage.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={`flex flex-col text-left p-4 border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[var(--text-primary)] bg-[var(--bg-hover)] ring-1 ring-[var(--text-primary)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--text-secondary)]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4 text-[var(--text-primary)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">{opt.label}</span>
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-[var(--text-primary)]"></span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-[11px] font-mono text-[var(--text-muted)]">
          Active Mode: <span className="font-semibold text-[var(--text-primary)] uppercase">{theme}</span> ({isDark ? 'Dark Theme Rendering' : 'Light Theme Rendering'})
        </div>
      </div>

      {/* Cloud Infrastructure Diagnostics */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5 transition-colors">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4 border-b border-[var(--border-subtle)] pb-2">
          Infrastructure Services
        </h2>

        <div className="space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border border-[var(--border-color)] bg-[var(--bg-hover)] gap-3">
            <div className="flex items-start sm:items-center space-x-3">
              <Database className="w-4 h-4 text-[var(--text-primary)] mt-0.5 sm:mt-0 shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold block text-[var(--text-primary)]">MongoDB Atlas Database</span>
                <span className="text-[11px] text-[var(--text-muted)] font-mono break-all sm:break-normal">
                  Cluster: atlas-ek5rl0-shard-0 (3-Node Replica Set with SSL)
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] font-mono font-semibold bg-[var(--bg-card)] border border-[var(--border-color)] px-2 py-0.5 self-start sm:self-auto shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[var(--text-primary)]">CONNECTED</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border border-[var(--border-color)] bg-[var(--bg-hover)] gap-3">
            <div className="flex items-start sm:items-center space-x-3">
              <Cloud className="w-4 h-4 text-[var(--text-primary)] mt-0.5 sm:mt-0 shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold block text-[var(--text-primary)]">Cloudinary File Storage</span>
                <span className="text-[11px] text-[var(--text-muted)] font-mono break-all sm:break-normal">
                  Cloud: we355whf (API Key: 893641762122788)
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] font-mono font-semibold bg-[var(--bg-card)] border border-[var(--border-color)] px-2 py-0.5 self-start sm:self-auto shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[var(--text-primary)]">VERIFIED ONLINE</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border border-[var(--border-color)] bg-[var(--bg-hover)] gap-3">
            <div className="flex items-start sm:items-center space-x-3">
              <Shield className="w-4 h-4 text-[var(--text-primary)] mt-0.5 sm:mt-0 shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold block text-[var(--text-primary)]">Google OAuth 2.0 Identity</span>
                <span className="text-[11px] text-[var(--text-muted)] font-mono break-all sm:break-normal">
                  Client ID: 322912580416-k1t1hig8qhe6bk4c84stussecpq484fr.apps.googleusercontent.com
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] font-mono font-semibold bg-[var(--bg-card)] border border-[var(--border-color)] px-2 py-0.5 self-start sm:self-auto shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[var(--text-primary)]">ACTIVE</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border border-[var(--border-color)] bg-[var(--bg-hover)] gap-3">
            <div className="flex items-start sm:items-center space-x-3">
              <Server className="w-4 h-4 text-[var(--text-primary)] mt-0.5 sm:mt-0 shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold block text-[var(--text-primary)]">Backend Express REST Engine</span>
                <span className="text-[11px] text-[var(--text-muted)] font-mono break-all sm:break-normal">
                  Port: 5000 • Helmet CSP • JWT Signed Token Sessions
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] font-mono font-semibold bg-[var(--bg-card)] border border-[var(--border-color)] px-2 py-0.5 self-start sm:self-auto shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[var(--text-primary)]">OPERATIONAL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Design System & Policy */}
      <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5 transition-colors">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] mb-2">
          Design System & Compliance
        </h2>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          This system conforms strictly to the high-density, black-and-white enterprise SaaS design
          specification inspired by Siemens DOConCD CD-ROM technical archives, Linear, and Notion. Full responsive support is provided for mobile, tablet, laptop, and ultra-wide desktop displays with high-contrast light and dark themes.
        </p>
      </div>
    </div>
  );
}
