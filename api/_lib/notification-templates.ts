import type { PushNotificationCategory, PushNotificationType } from '@gg/shared/types';

export interface NotificationContent {
  category: PushNotificationCategory;
  title: string;
  body: string;
  data: Record<string, string>;
}

export function buildNotificationContent(
  type: PushNotificationType,
  firstName: string | null,
): NotificationContent {
  const title = `Hi ${firstName ?? 'there'}!`;
  switch (type) {
    case 'morning_checkin':
      return {
        category: 'habit',
        title,
        body: "Two minutes of morning check-in. Let's set up your day.",
        data: { route: '/home', type },
      };
    case 'evening_checkin':
      return {
        category: 'journal',
        title,
        body: "Five minutes of evening reflection. Let's close the day clean.",
        data: { route: '/journal', type },
      };
  }
}
