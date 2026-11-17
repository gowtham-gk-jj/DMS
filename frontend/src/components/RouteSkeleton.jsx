import React from 'react';

export default function RouteSkeleton({ message = 'Loading workspace...' }) {
  return (
    <div className="w-full h-full min-h-[50vh] p-4 sm:p-6 space-y-4 animate-pulse">
      {/* Header bar placeholder */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
        <div className="space-y-2">
          <div className="h-6 w-48 sm:w-64 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
          <div className="h-3.5 w-32 sm:w-40 bg-slate-100 dark:bg-slate-850 rounded"></div>
        </div>
        <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
      </div>

      {/* Metric / Stat cards placeholder */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="h-4 w-4 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
            </div>
            <div className="h-7 w-28 bg-slate-300 dark:bg-slate-700 rounded"></div>
          </div>
        ))}
      </div>

      {/* Main content table / grid placeholder */}
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4 space-y-3">
        <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded"></div>
        <div className="space-y-2 pt-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-9 w-full bg-slate-100 dark:bg-slate-850 rounded-md"
            ></div>
          ))}
        </div>
      </div>

      <div className="text-center pt-2">
        <span className="font-mono text-xs text-[var(--text-muted)] tracking-wider">
          {message}
        </span>
      </div>
    </div>
  );
}
