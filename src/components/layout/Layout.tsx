import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

export function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Hamburger button — visible on mobile only */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 p-3 glass rounded-lg shadow-lg hover:bg-cyan-100/50 transition-all border border-cyan-200/50 lg:hidden"
        aria-label="Toggle menu"
      >
        <div className="w-5 h-5 flex flex-col justify-center gap-1">
          <span className={`block h-0.5 w-full bg-slate-700 transition-all ${sidebarOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
          <span className={`block h-0.5 w-full bg-slate-700 transition-all ${sidebarOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-full bg-slate-700 transition-all ${sidebarOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </div>
      </button>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <main className="flex-1 lg:ml-60 pb-20 lg:pb-0">
        <div className="w-full mx-auto p-4 pt-16 lg:pt-4">
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
