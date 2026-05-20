/**
 * Tests for the optimistic sessionLogStore.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSessionLogStore } from '../sessionLogStore';

const STORE_KEY = 'mvp03_session_log';

function makeEvent(
  overrides: Partial<{
    id: string;
    timestamp: string;
    event_type: string;
    screen_id: string | null;
    payload: Record<string, unknown> | null;
    session_id: string;
  }> = {},
) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    session_id: overrides.session_id ?? 'sess-1',
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    event_type: overrides.event_type ?? 'navigate',
    screen_id: overrides.screen_id ?? null,
    payload: overrides.payload ?? null,
  };
}

describe('sessionLogStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionLogStore.getState().clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('appends events with sync_status=pending', () => {
    const ev = makeEvent({ event_type: 'habit_added' });
    useSessionLogStore.getState().appendEvent(ev);
    const state = useSessionLogStore.getState();
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      id: ev.id,
      event_type: 'habit_added',
      sync_status: 'pending',
    });
  });

  it('persists to localStorage on append', () => {
    const ev = makeEvent();
    useSessionLogStore.getState().appendEvent(ev);
    const raw = localStorage.getItem(STORE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe(ev.id);
  });

  it('markSynced flips sync_status for matching ids', () => {
    const a = makeEvent({ id: 'a' });
    const b = makeEvent({ id: 'b' });
    const store = useSessionLogStore.getState();
    store.appendEvent(a);
    store.appendEvent(b);
    store.markSynced(['a']);
    const events = useSessionLogStore.getState().events;
    expect(events.find((e) => e.id === 'a')?.sync_status).toBe('synced');
    expect(events.find((e) => e.id === 'b')?.sync_status).toBe('pending');
  });

  it('getDeltaSince returns events strictly after sinceTs, ascending', () => {
    const store = useSessionLogStore.getState();
    store.appendEvent(makeEvent({ id: '1', timestamp: '2026-05-20T10:00:00.000Z' }));
    store.appendEvent(makeEvent({ id: '2', timestamp: '2026-05-20T10:00:05.000Z' }));
    store.appendEvent(makeEvent({ id: '3', timestamp: '2026-05-20T10:00:10.000Z' }));
    const delta = useSessionLogStore.getState().getDeltaSince('2026-05-20T10:00:02.000Z');
    expect(delta.map((e) => e.id)).toEqual(['2', '3']);
  });

  it('getDeltaSince(null) returns all events ascending', () => {
    const store = useSessionLogStore.getState();
    store.appendEvent(makeEvent({ id: 'a', timestamp: '2026-05-20T10:00:05.000Z' }));
    store.appendEvent(makeEvent({ id: 'b', timestamp: '2026-05-20T10:00:01.000Z' }));
    const delta = useSessionLogStore.getState().getDeltaSince(null);
    expect(delta.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('hydrate merges synced server events with existing pending', () => {
    const store = useSessionLogStore.getState();
    const pending = makeEvent({ id: 'pending-1', timestamp: '2026-05-20T10:00:10.000Z' });
    store.appendEvent(pending);

    const serverEvents = [
      makeEvent({ id: 'server-1', timestamp: '2026-05-20T09:59:00.000Z' }),
      makeEvent({ id: 'server-2', timestamp: '2026-05-20T09:59:30.000Z' }),
    ];
    store.hydrate(serverEvents);

    const state = useSessionLogStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.events).toHaveLength(3);
    expect(state.events.map((e) => e.id)).toEqual(['server-1', 'server-2', 'pending-1']);
    expect(state.events.find((e) => e.id === 'server-1')?.sync_status).toBe('synced');
    expect(state.events.find((e) => e.id === 'pending-1')?.sync_status).toBe('pending');
  });

  it('hydrate dedupes against existing events by id', () => {
    const store = useSessionLogStore.getState();
    store.appendEvent(makeEvent({ id: 'dup', timestamp: '2026-05-20T10:00:00.000Z' }));
    store.hydrate([
      makeEvent({ id: 'dup', timestamp: '2026-05-20T10:00:00.000Z' }),
      makeEvent({ id: 'new', timestamp: '2026-05-20T09:00:00.000Z' }),
    ]);
    const events = useSessionLogStore.getState().events;
    expect(events).toHaveLength(2);
    expect(events.find((e) => e.id === 'dup')?.sync_status).toBe('pending'); // not overwritten
  });

  it('trims oldest synced events when over cap, preserves all pending', () => {
    const store = useSessionLogStore.getState();
    // Pre-seed 205 synced events via hydrate
    const synced = Array.from({ length: 205 }, (_, i) =>
      makeEvent({
        id: `s-${i}`,
        timestamp: new Date(2000000000000 + i * 1000).toISOString(),
      }),
    );
    store.hydrate(synced);
    // Then add 3 pending
    store.appendEvent(makeEvent({ id: 'p-1', timestamp: new Date(2000000300000).toISOString() }));
    store.appendEvent(makeEvent({ id: 'p-2', timestamp: new Date(2000000301000).toISOString() }));
    store.appendEvent(makeEvent({ id: 'p-3', timestamp: new Date(2000000302000).toISOString() }));

    const events = useSessionLogStore.getState().events;
    expect(events.length).toBeLessThanOrEqual(200);
    const pendingCount = events.filter((e) => e.sync_status === 'pending').length;
    expect(pendingCount).toBe(3);
    // Earliest synced should have been trimmed
    expect(events.find((e) => e.id === 's-0')).toBeUndefined();
  });

  it('loadFromStorage rehydrates from localStorage', () => {
    const ev = makeEvent({ id: 'persisted' });
    useSessionLogStore.getState().appendEvent(ev);
    // Simulate fresh page load: clear in-memory but keep localStorage
    useSessionLogStore.setState({ events: [], loaded: false });
    useSessionLogStore.getState().loadFromStorage();
    expect(useSessionLogStore.getState().events[0].id).toBe('persisted');
  });

  it('clear wipes both memory and localStorage', () => {
    useSessionLogStore.getState().appendEvent(makeEvent());
    expect(localStorage.getItem(STORE_KEY)).not.toBeNull();
    useSessionLogStore.getState().clear();
    expect(useSessionLogStore.getState().events).toHaveLength(0);
    expect(localStorage.getItem(STORE_KEY)).toBeNull();
  });
});
