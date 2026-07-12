// Self-hosted runtime for the Vercel-style api/ handlers + built SPA.
// Replaces `vercel dev` locally and Vercel serverless in preview/prod
// containers. Zero runtime deps: node:http + a small Vercel-compat shim.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import admin from '../api/admin/[...path].js';
import calendar from '../api/calendar/[...path].js';
import chat from '../api/chat/[...path].js';
import context from '../api/context/[...path].js';
import llm from '../api/llm/[...path].js';
import notifications from '../api/notifications/[...path].js';
import onboarding from '../api/onboarding/[...path].js';
import reflections from '../api/reflections/[...path].js';
import sessionLog from '../api/session_log/[...path].js';
import vapi from '../api/vapi/[...path].js';
import weekly from '../api/weekly/[...path].js';
import cartesiaTts from '../api/cartesia-tts.js';
import cartesiaTtsSse from '../api/cartesia-tts-sse.js';
import qaReset from '../api/qa-reset.js';
import qaSelfReset from '../api/qa/self-reset.js';
import qaUsers from '../api/qa/users.js';
import sonioxTempKey from '../api/soniox-temp-key.js';
import stt from '../api/stt.js';

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

const CATCH_ALLS: Record<string, Handler> = {
  admin,
  calendar,
  chat,
  context,
  llm,
  notifications,
  onboarding,
  reflections,
  session_log: sessionLog,
  vapi,
  weekly,
};

// rawBody: handler reads the stream itself (Vercel `bodyParser: false`).
const SINGLES: Record<string, { handler: Handler; rawBody?: boolean }> = {
  'cartesia-tts': { handler: cartesiaTts },
  'cartesia-tts-sse': { handler: cartesiaTtsSse },
  'qa-reset': { handler: qaReset },
  'qa/self-reset': { handler: qaSelfReset },
  'qa/users': { handler: qaUsers },
  'soniox-temp-key': { handler: sonioxTempKey },
  stt: { handler: stt, rawBody: true },
};

const PORT = Number(process.env.PORT || 3000);
const DIST = resolve(import.meta.dirname, '..', 'dist');
const BODY_LIMIT = 5 * 1024 * 1024;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((res, rej) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > BODY_LIMIT) {
        req.destroy();
        rej(new Error('body too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => res(Buffer.concat(chunks)));
    req.on('error', rej);
  });
}

// Adds the Vercel helpers the api/ handlers actually use (status/json,
// plus send/redirect for completeness) onto the node res object.
function vercelify(req: IncomingMessage, res: ServerResponse, url: URL, segments?: string[]) {
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    query[key] = all.length > 1 ? all : all[0];
  }
  if (segments) query['...path'] = segments.length ? segments : ['__index'];

  const vreq = req as VercelRequest;
  vreq.query = query;

  const vres = res as VercelResponse;
  vres.status = (code: number) => {
    res.statusCode = code;
    return vres;
  };
  vres.json = (obj: unknown) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return vres;
  };
  vres.send = (body: unknown) => {
    if (typeof body === 'object' && body !== null && !Buffer.isBuffer(body)) return vres.json(body);
    res.end(body as string | Buffer);
    return vres;
  };
  vres.redirect = ((statusOrUrl: number | string, maybeUrl?: string) => {
    const code = typeof statusOrUrl === 'number' ? statusOrUrl : 307;
    const dest = typeof statusOrUrl === 'string' ? statusOrUrl : (maybeUrl as string);
    res.statusCode = code;
    res.setHeader('Location', dest);
    res.end();
    return vres;
  }) as VercelResponse['redirect'];
  return { vreq, vres };
}

async function parseBody(req: VercelRequest): Promise<void> {
  const method = req.method || 'GET';
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
  const type = (req.headers['content-type'] || '').split(';')[0].trim();
  const raw = await readBody(req);
  if (!raw.length) return;
  if (type === 'application/json') {
    req.body = JSON.parse(raw.toString('utf8'));
  } else if (type === 'application/x-www-form-urlencoded') {
    req.body = Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
  } else if (type.startsWith('text/')) {
    req.body = raw.toString('utf8');
  } else {
    req.body = raw;
  }
}

function serveStatic(res: ServerResponse, urlPath: string): boolean {
  if (!existsSync(DIST)) return false;
  const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, safe);
  if (!file.startsWith(DIST)) return false;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) file = join(DIST, 'index.html'); // SPA fallback
  if (!existsSync(file)) return false;
  const ext = extname(file);
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  // Hashed assets are immutable; html/sw must revalidate for PWA updates.
  res.setHeader(
    'Cache-Control',
    /\/assets\//.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache',
  );
  createReadStream(file).pipe(res);
  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://internal');
  const path = url.pathname;

  try {
    if (path === '/healthz') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (path === '/api' || path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      const rest = path.slice('/api/'.length).replace(/\/+$/, '');
      const [head, ...tail] = rest.split('/').filter(Boolean);

      const single = SINGLES[head === 'qa' && tail.length ? `qa/${tail[0]}` : head];
      if (single && (head !== 'qa' || tail.length)) {
        const { vreq, vres } = vercelify(req, res, url);
        if (!single.rawBody) await parseBody(vreq);
        await single.handler(vreq, vres);
        return;
      }

      const catchAll = head ? CATCH_ALLS[head] : undefined;
      if (catchAll) {
        const { vreq, vres } = vercelify(req, res, url, tail);
        await parseBody(vreq);
        await catchAll(vreq, vres);
        return;
      }

      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (serveStatic(res, path)) return;
    }
    res.statusCode = 404;
    res.end('Not found');
  } catch (err) {
    console.error(`[server] ${req.method} ${path} failed:`, err);
    if (!res.headersSent) {
      res.statusCode = err instanceof SyntaxError ? 400 : 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: err instanceof SyntaxError ? 'Invalid JSON' : 'Internal server error',
        }),
      );
    } else {
      res.end();
    }
  }
});

server.listen(PORT, () => {
  console.log(
    `[server] listening on :${PORT} (dist ${existsSync(DIST) ? 'found' : 'absent — API only'})`,
  );
});
