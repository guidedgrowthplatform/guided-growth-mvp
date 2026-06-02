/**
 * Local optimistic session_log store. Holds the last ~200 events the user
 * generated so the state_delta for LLM context can be reconstructed
 * synchronously — Vapi no longer waits for `GET /api/context/state` round-trip
 * when navigating between screens.
 *
 * Events are written here FIRST (sync), then mirrored to /api/session_log
 * (fire-and-forget). On success the row is marked synced; on failure the
 * existing offlineQueue retries the POST.
 *
 * Hydration on cold start (returning user, cleared storage) is performed by
 * SessionLogProvider — see task #13.
 */
import { create } from 'zustand';
import type { SessionStateDeltaEntry } from '@gg/shared/types/context';

const STORE_KEY = 'mvp03_session_log';
const MAX_EVENTS = 200;
const DELTA_LIMIT = 50;

export interface SessionLogEvent extends SessionStateDeltaEntry {
  sync_status: 'pending' | 'synced';
}

interface SessionLogStoreState {
  events: SessionLogEvent[];
  loaded: boolean;
  hydrated: boolean;

  appendEvent: (event: Omit<SessionLogEvent, 'sync_status'>) => void;
  markSynced: (ids: string[]) => void;
  getDeltaSince: (sinceTs: string | null) => SessionStateDeltaEntry[];
  hydrate: (events: SessionStateDeltaEntry[]) => void;
  clear: () => void;
  loadFromStorage: () => void;
}

function readStorage(): SessionLogEvent[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEvent);
  } catch {
    return [];
  }
}

function isValidEvent(e: unknown): e is SessionLogEvent {
  if (!e || typeof e !== 'object') return false;
  const ev = e as Record<string, unknown>;
  return (
    typeof ev.id === 'string' &&
    typeof ev.session_id === 'string' &&
    typeof ev.timestamp === 'string' &&
    typeof ev.event_type === 'string' &&
    (ev.sync_status === 'pending' || ev.sync_status === 'synced')
  );
}

function persist(events: SessionLogEvent[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(events));
  } catch {
    // localStorage quota or disabled — silently drop persistence;
    // in-memory store still works for the current session.
  }
}

// Keep all pending; trim oldest synced when over cap. Pending events must
// never be dropped — those represent unsynced data.
function trim(events: SessionLogEvent[]): SessionLogEvent[] {
  if (events.length <= MAX_EVENTS) return events;
  const pending = events.filter((e) => e.sync_status === 'pending');
  const synced = events.filter((e) => e.sync_status === 'synced');
  const keepSynced = MAX_EVENTS - pending.length;
  if (keepSynced <= 0) return pending;
  return [...synced.slice(-keepSynced), ...pending].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : 1,
  );
}

function toDeltaEntry(e: SessionLogEvent): SessionStateDeltaEntry {
  return {
    id: e.id,
    session_id: e.session_id,
    timestamp: e.timestamp,
    event_type: e.event_type,
    screen_id: e.screen_id,
    payload: e.payload,
  };
}

export const useSessionLogStore = create<SessionLogStoreState>((set, get) => ({
  events: [],
  loaded: false,
  hydrated: false,

  appendEvent: (event) => {
    const next = trim([...get().events, { ...event, sync_status: 'pending' }]);
    set({ events: next });
    persist(next);
  },

  markSynced: (ids) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const next = get().events.map((e) =>
      idSet.has(e.id) && e.sync_status === 'pending' ? { ...e, sync_status: 'synced' as const } : e,
    );
    set({ events: next });
    persist(next);
  },

  getDeltaSince: (sinceTs) => {
    const events = get().events;
    const filtered = sinceTs ? events.filter((e) => e.timestamp > sinceTs) : events;
    // Match server semantics: ascending by timestamp, capped.
    return filtered
      .slice()
      .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
      .slice(-DELTA_LIMIT)
      .map(toDeltaEntry);
  },

  hydrate: (entries) => {
    // Bulk seed from server. Treat all hydrated entries as already synced.
    // Merge with existing pending entries (in case user wrote optimistically
    // before hydration landed).
    const existing = get().events;
    const pending = existing.filter((e) => e.sync_status === 'pending');
    const existingIds = new Set(existing.map((e) => e.id));
    const hydrated: SessionLogEvent[] = entries
      .filter((e) => !existingIds.has(e.id))
      .map((e) => ({ ...e, sync_status: 'synced' }));
    const merged = trim(
      [...hydrated, ...pending].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1)),
    );
    set({ events: merged, hydrated: true });
    persist(merged);
  },

  clear: () => {
    set({ events: [], hydrated: false });
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {
      // ignore
    }
  },

  loadFromStorage: () => {
    const events = readStorage();
    set({ events, loaded: true });
  },
}));

// Auto-load on import (matches voiceSettingsStore pattern)
if (typeof window !== 'undefined') {
  useSessionLogStore.getState().loadFromStorage();
}
