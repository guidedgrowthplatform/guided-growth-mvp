import { Link, useLocation } from 'react-router-dom';
import { logout } from '@/api/auth';
import { useAuth } from '@/hooks/useAuth';

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
      {open && <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={onClose} />}

      {/* Desktop sidebar */}
      <aside
        className={`glass fixed left-0 top-0 z-40 flex h-full w-60 flex-col border-r border-cyan-200/50 shadow-xl transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} `}
      >
        <div className="border-b border-cyan-200/30 p-6">
          <h1 className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-2xl font-bold text-transparent">
            Life Tracker
          </h1>
          <div className="mt-2 inline-block rounded bg-slate-100/50 px-2 py-1 font-mono text-xs text-slate-500">
            {APP_VERSION}
          </div>
        </div>

        {user && (
          <div className="border-b border-cyan-200/30 p-4">
            <div className="flex items-center gap-3">
              {user.image && <img src={user.image} alt="" className="h-8 w-8 rounded-full" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-800">{user.name}</div>
                <div className="truncate text-xs text-slate-500">{user.email}</div>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              if (item.adminOnly && user?.role !== 'admin') return null;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300 ${
                      isActive
                        ? 'glow border border-cyan-300/50 bg-gradient-to-r from-cyan-400/30 to-blue-400/30 font-medium text-cyan-700 shadow-lg'
                        : 'text-slate-700 hover:border hover:border-cyan-200/50 hover:bg-cyan-100/30'
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

        {user && (
          <div className="border-t border-cyan-200/30 p-4">
            <button
              onClick={() => logout()}
              className="w-full py-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
            >
              Sign out
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
