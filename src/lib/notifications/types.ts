import type { PushNotificationCategory } from '@gg/shared/types';

export type NotificationCategory = PushNotificationCategory;

export interface NotificationDetail {
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  insight?: { title: string; body: string };
  action?: { label: string; to: string };
}

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  icon: string;
  iconClass: string;
  iconBg: string;
  image?: string;
  title: string;
  body: string;
  createdAt: string;
  unread: boolean;
  cta?: { label: string; to: string };
  detail?: NotificationDetail;
}
