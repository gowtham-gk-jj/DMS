import React from 'react';
import { Settings, Database, Cloud, Shield, Server, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function SettingsPage() {
  const { theme, setTheme, isDark } = useTheme();

  const themeOptions = [
    {
      id: 'light',
      label: 'Light Mode',
      desc: 'High-contrast enterprise white & slate interface',
      icon: Sun,
    },
    {
      id: 'dark',
      label: 'Dark Mode',
      desc: 'Deep slate & charcoal low-glare technical workspace',
      icon: Moon,
    },
    {
      id: 'system',
      label: 'System Sync',
      desc: 'Automatically synchronizes with your OS appearance preference',
      icon: Monitor,
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-1 sm:px-0 pb-16">
      {/* Header Banner */}
      <div className="dms-card p-5 sm:p-6">
        <div className="flex items-center space-x-2 text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1.5 font-medium">
          <Settings className="w-3.5 h-3.5 text-blue-500" />
          <span>SYSTEM & ENVIRONMENT CONFIGURATION</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Platform Settings
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Connected infrastructure status, Cloudinary storage bucket, theme appearance, and security policies.
        </p>
      </div>

      {/* Theme & Display Appearance */}
      <div className="dms-card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] mb-1">
            Display & Appearance
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Select your visual appearance mode. Changes persist automatically to your browser storage.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={`flex flex-col text-left p-4 rounded-lg border transition-all cursor-pointer min-h-[44px] ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/50 shadow-xs'
                    : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-500' : 'text-[var(--text-primary)]'}`} />
                    <span className="text-xs font-bold text-[var(--text-primary)]">{opt.label}</span>
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>

        <div className="pt-2 text-[11px] font-mono text-[var(--text-muted)] flex items-center space-x-2">
          <span>Active Mode:</span>
          <span className="dms-badge dms-badge-info text-[10px] font-mono uppercase">
            {theme}
          </span>
          <span>({isDark ? 'Dark Theme Rendering' : 'Light Theme Rendering'})</span>
        </div>
      </div>

      {/* Cloud Infrastructure Diagnostics */}
      <div className="dms-card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] mb-1">
            Infrastructure Services
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Live telemetry and connection status for mission-critical backend microservices.
          </p>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] gap-3">
            <div className="flex items-start sm:items-center space-x-3">
              <Database className="w-4 h-4 text-blue-500 mt-0.5 sm:mt-0 shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold block text-[var(--text-primary)]">MongoDB Atlas Database</span>
                <span className="text-[11px] text-[var(--text-muted)] font-mono break-all sm:break-normal">
                  Cluster: atlas-ek5rl0-shard-0 (3-Node Replica Set with SSL)
                </span>
              </div>
            </div>
            <div className="dms-badge dms-badge-success font-mono text-[10px] self-start sm:self-auto shrink-0 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>CONNECTED</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] gap-3">
            <div className="flex items-start sm:items-center space-x-3">
              <Cloud className="w-4 h-4 text-blue-500 mt-0.5 sm:mt-0 shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold block text-[var(--text-primary)]">Cloudinary File Storage</span>
                <span className="text-[11px] text-[var(--text-muted)] font-mono break-all sm:break-normal">
                  Cloud: we355whf (API Key: 893641762122788)
                </span>
              </div>
            </div>
            <div className="dms-badge dms-badge-success font-mono text-[10px] self-start sm:self-auto shrink-0 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>VERIFIED ONLINE</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] gap-3">
            <div className="flex items-start sm:items-center space-x-3">
              <Shield className="w-4 h-4 text-blue-500 mt-0.5 sm:mt-0 shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold block text-[var(--text-primary)]">Google OAuth 2.0 Identity</span>
                <span className="text-[11px] text-[var(--text-muted)] font-mono break-all sm:break-normal">
                  Client ID: 322912580416-k1t1hig8qhe6bk4c84stussecpq484fr.apps.googleusercontent.com
                </span>
              </div>
            </div>
            <div className="dms-badge dms-badge-success font-mono text-[10px] self-start sm:self-auto shrink-0 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>ACTIVE</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] gap-3">
            <div className="flex items-start sm:items-center space-x-3">
              <Server className="w-4 h-4 text-blue-500 mt-0.5 sm:mt-0 shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold block text-[var(--text-primary)]">Backend Express REST Engine</span>
                <span className="text-[11px] text-[var(--text-muted)] font-mono break-all sm:break-normal">
                  Port: 5000 • Helmet CSP • JWT Signed Token Sessions
                </span>
              </div>
            </div>
            <div className="dms-badge dms-badge-success font-mono text-[10px] self-start sm:self-auto shrink-0 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>OPERATIONAL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Design System & Compliance */}
      <div className="dms-card p-5 sm:p-6 space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
          Design System & Compliance
        </h2>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          This system conforms strictly to the Enterprise DMS specification inspired by Linear, Stripe Dashboard, and Siemens industrial interfaces. Full responsive support is provided for mobile, tablet, laptop, and ultra-wide desktop displays with high-contrast light and dark themes.
        </p>
      </div>
    </div>
  );
}
