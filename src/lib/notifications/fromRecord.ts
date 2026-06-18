import type { NotificationRecord } from '@gg/shared/types';
import type { AppNotification } from './types';

const TYPE_PRESENTATION: Record<string, { icon: string; ctaLabel: string }> = {
  morning_checkin: { icon: 'mdi:weather-sunny', ctaLabel: 'Start check-in' },
  evening_checkin: { icon: 'mdi:weather-night', ctaLabel: 'Open Journal' },
};

export function fromRecord(record: NotificationRecord): AppNotification {
  const presentation = TYPE_PRESENTATION[record.type];
  const route = record.data?.route;
  return {
    id: record.id,
    category: record.category,
    icon: presentation?.icon ?? 'mdi:bell-outline',
    iconClass: 'text-primary',
    iconBg: 'bg-primary-bg',
    title: record.title,
    body: record.body,
    createdAt: record.created_at,
    unread: !record.read_at,
    cta: presentation && route ? { label: presentation.ctaLabel, to: route } : undefined,
  };
}
