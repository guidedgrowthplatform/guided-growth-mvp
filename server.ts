/**
 * server.ts — Express adapter that runs the Vercel-style `api/**` handlers as
 * one long-lived Node process. Lets the engine run anywhere a container runs
 * (Azure Container Apps) with zero changes to the handlers themselves.
 *
 * How it maps Vercel's file-based routing:
 *   api/stt.ts                -> GET/POST /api/stt              (exact)
 *   api/qa/users.ts           -> /api/qa/users                 (exact, nested)
 *   api/llm/[...path].ts      -> /api/llm/*  (segments injected as req.query['...path'])
 *
 * Three Vercel-isms handled:
 *   1. Catch-all `[...path]` -> the matched tail is split and written to
 *      req.query['...path'] exactly as @vercel/node would populate it.
 *   2. Body parsing: express.json() everywhere EXCEPT /api/stt, which reads a
 *      raw multipart stream itself (its handler sets bodyParser:false on Vercel).
 *   3. waitUntil: handlers call waitUntil() from @vercel/functions for
 *      fire-and-forget work (sentry flush, session-log finalize). Off Vercel we
 *      install a request-context global so those promises just run in-process
 *      (the Node event loop stays alive, so no platform keep-alive is needed).
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

// ── 1. Make @vercel/functions.waitUntil() run the promise in-process ──────────
// @vercel/functions looks up globalThis[Symbol.for('@vercel/request-context')]
// and calls .get().waitUntil(promise). Providing it turns waitUntil into a
// safe fire-and-forget instead of a no-op-or-throw off-platform.
const REQUEST_CONTEXT = Symbol.for('@vercel/request-context');
const requestContext = {
  get: () => ({
    waitUntil: (promise: unknown) => {
      Promise.resolve(promise).catch((err) => console.error('[waitUntil]', err));
    },
  }),
};
(globalThis as Record<symbol, unknown>)[REQUEST_CONTEXT] = requestContext;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.join(__dirname, 'api');
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 8080;

type Handler = (req: Request, res: Response) => unknown | Promise<unknown>;

// ── 2. Discover handler files under api/, skipping libs and tests ─────────────
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === '_lib' || entry.name === '__tests__') continue;
      out.push(...walk(path.join(dir, entry.name)));
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

interface CatchAll {
  key: string; // path prefix before the [...] segment, e.g. "llm" or "qa/foo"
  handler: Handler;
}

const exactRoutes = new Map<string, Handler>();
const catchalls: CatchAll[] = [];

async function buildRoutes(): Promise<void> {
  const files = fs.existsSync(API_DIR) ? walk(API_DIR) : [];
  for (const file of files) {
    const mod = (await import(pathToFileURL(file).href)) as { default?: Handler };
    const handler = mod.default;
    if (typeof handler !== 'function') {
      // Not a route handler (e.g. a shared helper that slipped through). Skip.
      continue;
    }
    const rel = path.relative(API_DIR, file).replace(/\.ts$/, '');
    if (rel.includes('[...')) {
      const key = rel.replace(/\/?\[\.\.\.[^/]*].*$/, ''); // "llm/[...path]" -> "llm"
      catchalls.push({ key, handler });
    } else {
      exactRoutes.set(rel, handler);
    }
  }
  // Longest prefix first so a deeper catch-all wins over a shallower one.
  catchalls.sort((a, b) => b.key.length - a.key.length);
}

// ── 3. Run a handler with Vercel-ish error semantics ──────────────────────────
async function runHandler(handler: Handler, req: Request, res: Response): Promise<void> {
  try {
    await handler(req, res);
  } catch (err) {
    console.error('[handler error]', req.method, req.originalUrl, err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    else res.end();
  }
}

// Shadow the (possibly lazy/uncached) req.query getter with a plain data object
// that carries the injected catch-all segments. Robust across Express 4 and 5.
function injectPath(req: Request, segments: string[]): void {
  const merged = { ...req.query, '...path': segments };
  Object.defineProperty(req, 'query', { value: merged, writable: true, configurable: true });
}

async function main(): Promise<void> {
  await buildRoutes();
  console.log(
    `[server] loaded ${exactRoutes.size} exact routes, ${catchalls.length} catch-all groups: ${catchalls
      .map((c) => c.key)
      .join(', ')}`,
  );

  const app = express();
  app.disable('x-powered-by');

  // Health probe for ACA readiness/liveness — never touches the app.
  app.get('/healthz', (_req, res) => {
    res.status(200).json({ ok: true, routes: exactRoutes.size + catchalls.length });
  });

  // Body parsing: JSON everywhere under /api EXCEPT /api/stt (raw multipart).
  const jsonParser = express.json({ limit: '15mb' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/')) return next();
    if (req.path === '/api/stt') return next();
    return jsonParser(req, res, next);
  });

  // API dispatcher — exact match first, then longest catch-all prefix.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path !== '/api' && !req.path.startsWith('/api/')) return next();
    const rel = req.path.replace(/^\/api\/?/, '').replace(/\/+$/, '');

    const exact = exactRoutes.get(rel);
    if (exact) return void runHandler(exact, req, res);

    for (const c of catchalls) {
      if (rel === c.key || rel.startsWith(c.key + '/')) {
        const tail = rel === c.key ? '' : rel.slice(c.key.length + 1);
        const segments = tail ? tail.split('/').map(decodeURIComponent) : [];
        injectPath(req, segments);
        return void runHandler(c.handler, req, res);
      }
    }
    return void res.status(404).json({ error: 'API route not found', path: req.path });
  });

  // Static SPA (built by `vite build` into dist/). Optional — present in the
  // container image, absent when running the API alone for a smoke test.
  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR, { index: false }));
    // SPA history fallback: any non-API GET returns index.html.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api/')) return next();
      const index = path.join(DIST_DIR, 'index.html');
      if (fs.existsSync(index)) return res.sendFile(index);
      return next();
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[server] listening on http://0.0.0.0:${PORT} (dist ${fs.existsSync(DIST_DIR) ? 'served' : 'absent'})`,
    );
  });
}

main().catch((err) => {
  console.error('[server] fatal startup error', err);
  process.exit(1);
});
