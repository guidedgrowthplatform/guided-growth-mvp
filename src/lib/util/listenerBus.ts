// Minimal synchronous pub/sub. Stable identity — create once (useRef), not per render.
export interface ListenerBus<T> {
  notify: (value: T) => void;
  subscribe: (listener: (value: T) => void) => () => void;
}

export function createListenerBus<T>(label: string): ListenerBus<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    notify(value) {
      for (const listener of listeners) {
        try {
          listener(value);
        } catch (err) {
          console.warn(`[${label}] listener threw:`, err);
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
