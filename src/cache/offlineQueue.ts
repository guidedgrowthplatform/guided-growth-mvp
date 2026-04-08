import { supabase } from '@/lib/supabase';

const QUEUE_KEY = 'lgt_offline_queue';
const PROCESSED_IDS_KEY = 'lgt_offline_queue_processed_ids';

interface QueuedMutation {
  id: string;
  endpoint: string;
  method: string;
  body: unknown;
  timestamp: number;
}

interface FlushResult {
  succeeded: number;
  retried: number;
  dropped: number;
  droppedDetails: Array<{ endpoint: string; status: number }>;
}

let flushInProgress = false;

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // No session — request will fail with 401, surfaced to caller via FlushResult.
  }
  return {};
}

export const offlineQueue = {
  enqueue(endpoint: string, method: string, body: unknown): void {
    const queue = this.getQueue();
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      endpoint,
      method,
      body,
      timestamp: Date.now(),
    });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  },

  getQueue(): QueuedMutation[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Flush queued mutations to the server.
   *
   * Bug history:
   *  - Previously fetched without auth headers, so every flush returned 401
   *    and the mutation was silently dropped (4xx → drop branch). User data
   *    saved offline was never synced. Now adds Authorization: Bearer.
   *  - Previously read the full queue, then on completion overwrote storage
   *    with only the failures — losing any mutations enqueued WHILE the
   *    flush was running. Now we read by id and re-merge with the live
   *    queue, removing only the ids we successfully processed.
   *  - Previously dropped 4xx silently. Now returns counts so the caller
   *    can surface a toast if anything was rejected.
   *
   * Concurrency-safe: a re-entrant call exits early so two flushes can't
   * race over the same ids.
   */
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

      const authHeaders = await getAuthHeaders();
      const succeededIds = new Set<string>();
      const droppedIds = new Set<string>();
      const droppedDetails: Array<{ endpoint: string; status: number }> = [];

      for (const mutation of snapshot) {
        try {
          const response = await fetch(mutation.endpoint, {
            method: mutation.method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(mutation.body),
          });
          if (response.ok) {
            succeededIds.add(mutation.id);
          } else if (response.status >= 400 && response.status < 500) {
            // Client error — won't get better on retry. Drop to avoid an
            // infinite retry loop, but record so the caller can warn the
            // user. 401 specifically often means the session expired
            // mid-offline-window; the user will need to re-auth and the
            // mutation is unrecoverable.
            droppedIds.add(mutation.id);
            droppedDetails.push({ endpoint: mutation.endpoint, status: response.status });
          }
          // 5xx and network errors fall through — id stays in the queue.
        } catch {
          // Network failure — leave in queue for next online event.
        }
      }

      // Re-read the queue and remove only the ids we processed. Anything
      // enqueued while we were awaiting fetch survives.
      const live = this.getQueue();
      const remaining = live.filter((m) => !succeededIds.has(m.id) && !droppedIds.has(m.id));
      localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));

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
