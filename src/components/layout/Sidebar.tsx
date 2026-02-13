import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const APP_VERSION = 'v2.0.0';

const navItems = [
  { path: '/capture', label: 'Capture', icon: '\u{1F4DD}' },
  { path: '/configure', label: 'Configure', icon: '\u{2699}\u{FE0F}' },
  { path: '/report', label: 'Report', icon: '\u{1F4CA}' },
  { path: '/admin', label: 'Admin', icon: '\u{1F510}', adminOnly: true },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <>
      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={onClose} />
      )}

      {/* Desktop sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-60 glass border-r border-cyan-200/50 flex flex-col shadow-xl z-40 transition-transform duration-300
          lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-6 border-b border-cyan-200/30">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Life Tracker
          </h1>
          <div className="mt-2 text-xs text-slate-500 font-mono bg-slate-100/50 px-2 py-1 rounded inline-block">
            {APP_VERSION}
          </div>
        </div>

        {user && (
          <div className="p-4 border-b border-cyan-200/30">
            <div className="flex items-center gap-3">
              {user.avatar_url && (
                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{user.name}</div>
                <div className="text-xs text-slate-500 truncate">{user.email}</div>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {navItems.map((item) => {
              if (item.adminOnly && user?.role !== 'admin') return null;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-400/30 to-blue-400/30 text-cyan-700 font-medium glow shadow-lg border border-cyan-300/50'
                        : 'text-slate-700 hover:bg-cyan-100/30 hover:border hover:border-cyan-200/50'
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
