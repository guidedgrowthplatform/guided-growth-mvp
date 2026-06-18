import { beforeEach, describe, expect, it, vi } from 'vitest';

let store: Record<string, string> = {};
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store[key] ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      store[key] = value;
    },
  },
}));

async function load() {
  vi.resetModules();
  return import('../localFeed');
}

const NOW = '2026-06-18T08:00:00.000Z';

describe('localFeed', () => {
  beforeEach(() => {
    store = {};
  });

  it('ensure → read round-trip', async () => {
    const { ensureLocalFeedEntry, getLocalFeed } = await load();
    expect(await ensureLocalFeedEntry('morning_checkin', 'Sam', NOW)).toBe(true);
    const feed = await getLocalFeed();
    expect(feed).toHaveLength(1);
    expect(feed[0].type).toBe('morning_checkin');
    expect(feed[0].read_at).toBeNull();
    expect(feed[0].id.startsWith('local:')).toBe(true);
  });

  it('idempotent per (type, day)', async () => {
    const { ensureLocalFeedEntry, getLocalFeed } = await load();
    expect(await ensureLocalFeedEntry('morning_checkin', 'Sam', NOW)).toBe(true);
    expect(await ensureLocalFeedEntry('morning_checkin', 'Sam', NOW)).toBe(false);
    expect(await getLocalFeed()).toHaveLength(1);
  });

  it('same type, different day adds a second entry', async () => {
    const { ensureLocalFeedEntry, getLocalFeed } = await load();
    await ensureLocalFeedEntry('morning_checkin', 'Sam', NOW);
    await ensureLocalFeedEntry('morning_checkin', 'Sam', '2026-06-19T08:00:00.000Z');
    expect(await getLocalFeed()).toHaveLength(2);
  });

  it('caps at 50 across many days', async () => {
    const { ensureLocalFeedEntry, getLocalFeed } = await load();
    for (let d = 1; d <= 55; d++) {
      const day = `2026-08-${String(d).padStart(2, '0')}T08:00:00.000Z`;
      await ensureLocalFeedEntry('morning_checkin', null, day);
    }
    expect(await getLocalFeed()).toHaveLength(50);
  });

  it('markLocalRead sets read_at', async () => {
    const { ensureLocalFeedEntry, getLocalFeed, markLocalRead } = await load();
    await ensureLocalFeedEntry('morning_checkin', 'Sam', NOW);
    const [entry] = await getLocalFeed();
    await markLocalRead(entry.id, NOW);
    expect((await getLocalFeed())[0].read_at).toBe(NOW);
  });

  it('markAllLocalRead marks every unread', async () => {
    const { ensureLocalFeedEntry, getLocalFeed, markAllLocalRead } = await load();
    await ensureLocalFeedEntry('morning_checkin', 'Sam', NOW);
    await ensureLocalFeedEntry('evening_checkin', 'Sam', NOW);
    await markAllLocalRead(NOW);
    expect((await getLocalFeed()).every((e) => e.read_at === NOW)).toBe(true);
  });

  it('recovers from corrupt stored JSON', async () => {
    const { getLocalFeed } = await load();
    store['local_notification_feed'] = '{not valid';
    expect(await getLocalFeed()).toEqual([]);
  });
});
