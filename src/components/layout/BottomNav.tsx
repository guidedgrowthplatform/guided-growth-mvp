import { Icon } from '@iconify/react';
import { Link, useLocation } from 'react-router-dom';

interface NavTabProps {
  icon: string;
  label: string;
  path: string;
  isActive: boolean;
}

function NavTab({ icon, label, path, isActive }: NavTabProps) {
  return (
    <Link
      to={path}
      className={`flex flex-col items-center justify-end ${isActive ? 'text-primary' : 'text-content-tertiary'}`}
    >
      <Icon icon={icon} width={24} />
      <span className="mt-0.5 text-[10px] font-bold">{label}</span>
    </Link>
  );
}

function NavBarBackground() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 400 80"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0px -4px 12px rgba(0,0,0,0.06))' }}
    >
      <path
        d="
          M0 16 C0 6, 6 0, 16 0
          L148 0
          C154 0, 158 2, 161 8
          A 38 38 0 0 0 200 42
          A 38 38 0 0 0 239 8
          C242 2, 246 0, 252 0
          L384 0
          C394 0, 400 6, 400 16
          L400 80 L0 80 Z
        "
        fill="white"
      />
    </svg>
  );
}

interface BottomNavProps {
  onVoicePress?: () => void;
}

export function BottomNav({ onVoicePress }: BottomNavProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/home';
    return location.pathname === path;
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto max-w-sm">
        <div className="relative" style={{ height: '72px' }}>
          <NavBarBackground />

          <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '-24px' }}>
            <button
              onClick={onVoicePress}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#2563eb] shadow-[0px_0px_15px_rgba(19,91,236,0.3)]"
            >
              <Icon icon="ic:round-mic" width={24} className="text-white" />
            </button>
          </div>

          <div className="relative grid h-full grid-cols-5 items-end px-6 pb-2">
            <NavTab icon="ic:round-home" label="Home" path="/" isActive={isActive('/')} />
            <NavTab
              icon="ic:round-leaderboard"
              label="Progress"
              path="/report"
              isActive={isActive('/report')}
            />
            <div />
            <NavTab
              icon="ic:round-calendar-month"
              label="Calendar"
              path="/calendar"
              isActive={isActive('/calendar')}
            />
            <NavTab
              icon="ic:round-person"
              label="Profile"
              path="/settings"
              isActive={isActive('/settings')}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
