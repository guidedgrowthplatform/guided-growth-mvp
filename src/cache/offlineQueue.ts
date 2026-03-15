const QUEUE_KEY = 'lgt_offline_queue';

const MAX_RETRIES = 3;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface QueuedMutation {
  id: string;
  endpoint: string;
  method: string;
  body: unknown;
  timestamp: number;
  retries?: number;
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable (e.g. iOS Private Browsing)
  }
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
    safeSetItem(QUEUE_KEY, JSON.stringify(queue));
  },

  getQueue(): QueuedMutation[] {
    try {
      const raw = safeGetItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async flush(): Promise<void> {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    const now = Date.now();
    const remaining: QueuedMutation[] = [];

    for (const mutation of queue) {
      // Discard mutations older than 24 hours
      if (now - mutation.timestamp > MAX_AGE_MS) continue;

      // Discard mutations that have exceeded max retries
      const retries = mutation.retries ?? 0;
      if (retries >= MAX_RETRIES) continue;

      try {
        const response = await fetch(mutation.endpoint, {
          method: mutation.method,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mutation.body),
        });
        if (!response.ok) {
          remaining.push({ ...mutation, retries: retries + 1 });
        }
      } catch {
        remaining.push({ ...mutation, retries: retries + 1 });
      }
    }

    safeSetItem(QUEUE_KEY, JSON.stringify(remaining));
  },

  clear(): void {
    try {
      localStorage.removeItem(QUEUE_KEY);
    } catch {
      // localStorage unavailable
    }
  },

  get length(): number {
    return this.getQueue().length;
  },
};
