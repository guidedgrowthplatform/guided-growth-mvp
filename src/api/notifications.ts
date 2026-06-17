import type { DevicePlatform, NotificationRecord } from '@gg/shared/types';
import { apiGet, apiPost } from './client';

export function fetchNotifications(): Promise<{ notifications: NotificationRecord[] }> {
  return apiGet<{ notifications: NotificationRecord[] }>('/api/notifications');
}

export function registerDeviceToken(
  token: string,
  platform: DevicePlatform,
): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>('/api/notifications/register-token', { token, platform });
}

export function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>('/api/notifications/read', { id });
}

export function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>('/api/notifications/read-all', {});
}
