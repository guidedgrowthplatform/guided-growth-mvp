import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type ModuleFactory<T> = () => Promise<{ default: T }>;

interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
}

const CHUNK_LOAD_ERROR_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|dynamically imported module|module script failed/i;

const RELOAD_FLAG = 'gg:chunk-reload-attempted';

export function isChunkLoadError(err: unknown): boolean {
  return err instanceof Error && CHUNK_LOAD_ERROR_RE.test(err.message);
}

function readReloadFlag(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === '1';
  } catch {
    return false;
  }
}

function setReloadFlag(): void {
  try {
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    return;
  }
}

function clearReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    return;
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function importWithRetry<R>(
  factory: () => Promise<R>,
  { retries = 2, baseDelayMs = 300 }: RetryOptions = {},
): Promise<R> {
  for (let attempt = 0; ; attempt++) {
    try {
      const mod = await factory();
      clearReloadFlag();
      return mod;
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;
      if (attempt < retries) {
        await delay(baseDelayMs * 2 ** attempt);
        continue;
      }
      if (!readReloadFlag()) {
        setReloadFlag();
        window.location.reload();
        return new Promise<R>(() => {});
      }
      throw err;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors React.lazy's signature
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: ModuleFactory<T>,
  opts?: RetryOptions,
): LazyExoticComponent<T> {
  return lazy(() => importWithRetry(factory, opts));
}
