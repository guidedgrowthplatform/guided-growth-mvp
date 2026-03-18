import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const APP_VERSION = 'v2.0.0';

const navItems = [
  { path: '/capture', label: 'Capture', icon: '\u{1F4DD}' },
  { path: '/configure', label: 'Configure', icon: '\u{2699}\u{FE0F}' },
  { path: '/report', label: 'Report', icon: '\u{1F4CA}' },
  { path: '/settings', label: 'Settings', icon: '\u{1F527}' },
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
        className={`fixed left-0 top-0 z-40 flex h-full w-60 flex-col border-r border-border bg-surface shadow-elevated transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} `}
      >
        <div className="border-b border-border p-6">
          <h1 className="text-2xl font-bold text-primary">Life Tracker</h1>
          <div className="mt-2 inline-block rounded bg-surface-secondary px-2 py-1 font-mono text-xs text-content-tertiary">
            {APP_VERSION}
          </div>
        </div>

        {user && (
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-3">
              {user.user_metadata?.avatar_url && (
                <img src={user.user_metadata.avatar_url} alt="" className="h-8 w-8 rounded-full" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-content">
                  {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                </div>
                <div className="truncate text-xs text-content-secondary">{user.email}</div>
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
                        ? 'border border-border bg-surface-secondary font-medium text-primary shadow-lg'
                        : 'text-content hover:border hover:border-border hover:bg-surface-secondary'
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
