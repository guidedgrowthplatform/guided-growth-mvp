import { Icon } from '@iconify/react';
import type { NotificationCategory } from '@/lib/notifications';

interface EmptyNotificationsProps {
  category: NotificationCategory;
}

// only the feed's tab categories appear here ('account' is never listed)
const COPY: Partial<Record<NotificationCategory, { icon: string; title: string; body: string }>> = {
  habit: {
    icon: 'mdi:bell-check-outline',
    title: "You're all caught up",
    body: 'Habit reminders and check-in nudges will show up here when it’s time.',
  },
  journal: {
    icon: 'mdi:notebook-outline',
    title: 'Nothing to reflect on yet',
    body: 'Evening reflections and journal prompts will land here.',
  },
};

export function EmptyNotifications({ category }: EmptyNotificationsProps) {
  const { icon, title, body } = COPY[category] ?? COPY.habit!;

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface px-6 py-7 text-center shadow-sm">
      <div className="mb-0.5 flex h-12 w-12 items-center justify-center rounded-full bg-primary-bg">
        <Icon icon={icon} width={24} height={24} className="text-primary" />
      </div>
      <h2 className="text-base font-bold text-content">{title}</h2>
      <p className="max-w-[15rem] text-sm leading-relaxed text-content-secondary">{body}</p>
    </div>
  );
}
