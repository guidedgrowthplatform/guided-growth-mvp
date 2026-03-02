import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { path: '/capture', label: 'Capture', icon: '\u{1F4DD}' },
  { path: '/configure', label: 'Config', icon: '\u{2699}\u{FE0F}' },
  { path: '/report', label: 'Report', icon: '\u{1F4CA}' },
  { path: '/settings', label: 'Settings', icon: '\u{1F527}' },
  { path: '/admin', label: 'Admin', icon: '\u{1F510}', adminOnly: true },
];

export function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden glass border-t border-cyan-200/50 safe-area-bottom">
      <div className="flex justify-around py-2">
        {navItems.map((item) => {
          if (item.adminOnly && user?.role !== 'admin') return null;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-3 py-1 min-w-[56px] rounded-lg transition-all ${
                isActive ? 'text-cyan-600' : 'text-slate-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
