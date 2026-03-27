const QUEUE_KEY = 'lgt_offline_queue';

interface QueuedMutation {
  id: string;
  endpoint: string;
  method: string;
  body: unknown;
  timestamp: number;
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

  async flush(): Promise<void> {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    const remaining: QueuedMutation[] = [];

    for (const mutation of queue) {
      try {
        const response = await fetch(mutation.endpoint, {
          method: mutation.method,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mutation.body),
        });
        if (!response.ok) {
          // Re-enqueue on server errors (5xx); drop on client errors (4xx) to avoid infinite retry
          if (response.status >= 500) {
            remaining.push(mutation);
          }
        }
      } catch {
        remaining.push(mutation);
      }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  },

  clear(): void {
    localStorage.removeItem(QUEUE_KEY);
  },

  get length(): number {
    return this.getQueue().length;
  },
};
