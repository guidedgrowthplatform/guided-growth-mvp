import { Preferences } from '@capacitor/preferences';
import type { NotificationRecord } from '@gg/shared/types';
import { buildNotificationContent, type PushNotificationType } from '@gg/shared';

const KEY = 'local_notification_feed';
const CAP = 50;
const LOCAL_PREFIX = 'local:';

export function isLocalFeedId(id: string): boolean {
  return id.startsWith(LOCAL_PREFIX);
}

async function read(): Promise<NotificationRecord[]> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? (parsed as NotificationRecord[]) : [];
  } catch {
    return [];
  }
}

async function write(entries: NotificationRecord[]): Promise<void> {
  try {
    await Preferences.set({ key: KEY, value: JSON.stringify(entries.slice(0, CAP)) });
  } catch {
    // best-effort; feed history is non-critical
  }
}

export function getLocalFeed(): Promise<NotificationRecord[]> {
  return read();
}

// idempotent per (type, local day) — mirrors the old cron's once-per-day insert,
// so background fires + taps don't double-add
export async function ensureLocalFeedEntry(
  type: PushNotificationType,
  firstName: string | null,
  nowIso: string,
): Promise<boolean> {
  const day = nowIso.slice(0, 10);
  const existing = await read();
  if (existing.some((e) => e.type === type && e.created_at.slice(0, 10) === day)) return false;

  const content = buildNotificationContent(type, firstName);
  const entry: NotificationRecord = {
    id: `${LOCAL_PREFIX}${crypto.randomUUID()}`,
    type,
    category: content.category,
    title: content.title,
    body: content.body,
    data: content.data,
    created_at: nowIso,
    read_at: null,
  };
  await write([entry, ...existing]);
  return true;
}

export async function markLocalRead(id: string, nowIso: string): Promise<void> {
  const entries = await read();
  await write(entries.map((e) => (e.id === id && !e.read_at ? { ...e, read_at: nowIso } : e)));
}

export async function markAllLocalRead(nowIso: string): Promise<void> {
  const entries = await read();
  await write(entries.map((e) => (e.read_at ? e : { ...e, read_at: nowIso })));
}
