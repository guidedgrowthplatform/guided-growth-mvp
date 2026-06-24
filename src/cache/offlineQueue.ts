import { getFreshToken } from '@/lib/auth/tokenStore';
import { getAuthHeaders } from '@/lib/services/api-auth';

const QUEUE_KEY = 'lgt_offline_queue';
const PROCESSED_IDS_KEY = 'lgt_offline_queue_processed_ids';
const MAX_QUEUE = 500;

export type QueuedItemKind = 'session_log' | 'entry' | 'unknown';

interface QueuedMutation {
  id: string;
  endpoint: string;
  method: string;
  body: unknown;
  timestamp: number;
  kind?: QueuedItemKind;
}

interface FlushResult {
  succeeded: number;
  retried: number;
  dropped: number;
  droppedDetails: Array<{ endpoint: string; status: number }>;
}

let flushInProgress = false;

// kind → replay handler. Set by feature modules to replay queued mutations
// through their domain layer instead of the now-removed REST endpoints.
type ReplayHandler = (body: unknown, endpoint: string) => Promise<void>;
const replayHandlers: Partial<Record<QueuedItemKind, ReplayHandler>> = {};
export function registerReplayHandler(kind: QueuedItemKind, fn: ReplayHandler): void {
  replayHandlers[kind] = fn;
}

// quota → drop oldest 50% + retry once; Safari private mode → returns false
function safeSetQueue(queue: QueuedMutation[]): boolean {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch (err) {
    try {
      const trimmed = queue.slice(Math.floor(queue.length / 2));
      localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
      console.warn('[offlineQueue] quota exceeded; dropped oldest 50%', err);
      return true;
    } catch (err2) {
      console.warn('[offlineQueue] localStorage unavailable; dropping write', err2);
      return false;
    }
  }
}

export const offlineQueue = {
  enqueue(
    endpoint: string,
    method: string,
    body: unknown,
    kind: QueuedItemKind = 'unknown',
  ): boolean {
    const queue = this.getQueue();
    const trimmed = queue.length >= MAX_QUEUE ? queue.slice(queue.length - (MAX_QUEUE - 1)) : queue;
    trimmed.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      endpoint,
      method,
      body,
      timestamp: Date.now(),
      kind,
    });
    return safeSetQueue(trimmed);
  },

  getQueue(): QueuedMutation[] {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      // corrupt JSON — clear instead of silently returning []
      console.warn('[offlineQueue] corrupt queue JSON; clearing', err);
      try {
        localStorage.removeItem(QUEUE_KEY);
      } catch {
        // ignore
      }
      return [];
    }
  },

  // Re-entrant calls early-exit so two flushes can't race over the same ids.
  async flush(): Promise<FlushResult> {
    if (flushInProgress) {
      return { succeeded: 0, retried: 0, dropped: 0, droppedDetails: [] };
    }
    flushInProgress = true;
    try {
      const snapshot = this.getQueue();
      if (snapshot.length === 0) {
        return { succeeded: 0, retried: 0, dropped: 0, droppedDetails: [] };
      }

      // Single refresh up front; 401/403 during replay requeue, never dropped.
      await getFreshToken();
      const succeededIds = new Set<string>();
      const droppedIds = new Set<string>();
      const droppedDetails: Array<{ endpoint: string; status: number }> = [];

      for (const mutation of snapshot) {
        const handler = mutation.kind ? replayHandlers[mutation.kind] : undefined;
        if (handler) {
          try {
            await handler(mutation.body, mutation.endpoint);
            succeededIds.add(mutation.id);
          } catch {
            // leave in queue for next retry
          }
          continue;
        }
        try {
          const authHeaders = await getAuthHeaders();
          const response = await fetch(mutation.endpoint, {
            method: mutation.method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(mutation.body),
          });
          if (response.ok) {
            succeededIds.add(mutation.id);
          } else if (
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 401 &&
            response.status !== 403
          ) {
            // genuine client error (bad payload) — drop + report
            droppedIds.add(mutation.id);
            droppedDetails.push({ endpoint: mutation.endpoint, status: response.status });
          }
          // 5xx / network / auth (401/403) → leave in queue, retry after refresh/login
        } catch {
          // network failure → leave in queue
        }
      }

      // Re-read so mutations enqueued during fetch survive
      const live = this.getQueue();
      const remaining = live.filter((m) => !succeededIds.has(m.id) && !droppedIds.has(m.id));
      safeSetQueue(remaining);

      return {
        succeeded: succeededIds.size,
        retried: snapshot.length - succeededIds.size - droppedIds.size,
        dropped: droppedIds.size,
        droppedDetails,
      };
    } finally {
      flushInProgress = false;
    }
  },

  clear(): void {
    localStorage.removeItem(QUEUE_KEY);
    localStorage.removeItem(PROCESSED_IDS_KEY);
  },

  get length(): number {
    return this.getQueue().length;
  },
};
