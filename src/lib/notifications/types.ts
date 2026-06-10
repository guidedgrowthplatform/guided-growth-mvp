// Frontend-only for now; moves to @gg/shared when the notifications backend lands.
export type NotificationCategory = 'habit' | 'journal';

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
