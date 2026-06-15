import { Icon } from '@iconify/react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { PERMISSIONS_SEEN_KEY } from '@/lib/permissions';

const PERMISSIONS = [
  {
    icon: 'mdi:bell-outline',
    title: 'Notifications',
    description: 'Allows us to deliver timely reminders and proactive messages.',
  },
  {
    icon: 'mdi:calendar-blank-outline',
    title: 'Calendar',
    description: 'Allows us to see what your day is like and help you plan ahead.',
  },
  {
    icon: 'mdi:web',
    title: 'Location',
    description: 'Allows us to personalize suggestions to your location.',
  },
];

export function EnablePermissionsPage() {
  const navigate = useNavigate();

  useEffect(() => {
    track('view_enable_permissions');
  }, []);

  const handleContinue = () => {
    track('tap_continue_permissions');
    localStorage.setItem(PERMISSIONS_SEEN_KEY, 'true');
    navigate('/notifications', { replace: true });
  };

  return (
    <div className="-mt-2 flex min-h-[calc(100dvh-9rem)] flex-col pb-8">
      <button
        type="button"
        aria-label="Back"
        onClick={() => navigate(-1)}
        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-card"
      >
        <Icon icon="ic:round-arrow-back" width={16} className="text-content" />
      </button>

      <div className="mt-8 text-center">
        <h1 className="text-[32px] font-bold text-content">Enable permissions</h1>
        <p className="mx-auto mt-4 max-w-[320px] text-base leading-relaxed text-content-secondary">
          Guided Growth works best with access to the following permissions
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-5">
        {PERMISSIONS.map(({ icon, title, description }) => (
          <div key={title} className="flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-sm">
            <Icon icon={icon} width={28} height={28} className="shrink-0 text-primary" />
            <div>
              <h2 className="text-base font-bold text-content">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-content-secondary">{description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-10">
        <button
          type="button"
          onClick={handleContinue}
          className="w-full rounded-full bg-primary py-4 text-base font-semibold text-white shadow-sm"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
