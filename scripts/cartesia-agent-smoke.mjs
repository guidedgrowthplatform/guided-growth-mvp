/**
 * Cartesia Line Agent WebSocket — Browser Protocol Smoke Test
 *
 * Verifies the browser-style auth assumption for `/agents/stream` by
 * minting an access token and connecting via the `?access_token=` query
 * parameter (the only mechanism that works in-browser since `WebSocket`
 * cannot set custom headers). Emulates exactly what `useRealtimeVoice`
 * will do so we can validate the protocol before wiring it into React.
 *
 * Procedure:
 *   1. Mint a 1h access token with `grants.agent = true`.
 *   2. Open wss://api.cartesia.ai/agents/stream/{agent_id}
 *      ?access_token=<token>&cartesia_version=2026-03-01
 *   3. Send a `start` event with metadata matching what the frontend sends.
 *   4. Wait up to 15s for an `ack` event. Success = exit 0.
 *   5. On connection failure, retry against the `agents.cartesia.ai`
 *      subdomain (the Go reference client uses this host).
 *   6. Log every event received so we can confirm which server→client
 *      events actually fire (ack / media_output / clear / transfer_call).
 *
 * Requires:
 *   - Node 22+ (native WebSocket + fetch)
 *   - .env.local with CARTESIA_API_KEY and VITE_CARTESIA_AGENT_ID
 *
 * Usage:
 *   npm run smoke:agent
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Env loading (no dotenv dep — keep script self-contained) ────────────────

function loadEnvFile(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const env = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[match[1]] = value;
    }
    return env;
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

const envLocal = loadEnvFile(resolve(process.cwd(), '.env.local'));
const env = { ...envLocal, ...process.env };

const CARTESIA_API_KEY = env.CARTESIA_API_KEY;
const AGENT_ID = env.VITE_CARTESIA_AGENT_ID;
const CARTESIA_VERSION = '2026-03-01';

if (!CARTESIA_API_KEY) {
  console.error('[smoke] missing CARTESIA_API_KEY in .env.local');
  process.exit(2);
}
if (!AGENT_ID) {
  console.error('[smoke] missing VITE_CARTESIA_AGENT_ID in .env.local');
  process.exit(2);
}
if (typeof WebSocket === 'undefined') {
  console.error('[smoke] global WebSocket not available — need Node 22+');
  process.exit(2);
}

// ─── 1. Mint access token ────────────────────────────────────────────────────

async function mintAccessToken() {
  const res = await fetch('https://api.cartesia.ai/access-token', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CARTESIA_API_KEY}`,
      'Content-Type': 'application/json',
      'Cartesia-Version': CARTESIA_VERSION,
    },
    body: JSON.stringify({
      expires_in: 3600,
      grants: { agent: true },
    }),
  });
  if (!res.ok) {
    throw new Error(`access-token mint failed ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  if (typeof data?.token !== 'string' || data.token.length === 0) {
    throw new Error(`access-token mint returned unexpected shape: ${JSON.stringify(data)}`);
  }
  return data.token;
}

// ─── 2. Connect WebSocket ────────────────────────────────────────────────────

/**
 * Try to connect to the given host with query-param auth.
 * Resolves with the `ack` event payload, rejects on failure or timeout.
 */
function attemptConnection({ host, token, label }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const url =
      `wss://${host}/agents/stream/${AGENT_ID}` +
      `?access_token=${encodeURIComponent(token)}` +
      `&cartesia_version=${CARTESIA_VERSION}`;

    console.log(`[smoke] ${label}: connecting to ${host}…`);
    const ws = new WebSocket(url);

    let settled = false;
    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* noop */
      }
    };

    const timer = setTimeout(() => {
      if (settled) return;
      cleanup();
      rejectPromise(new Error(`${label}: timeout waiting for ack after 15s`));
    }, 15000);

    ws.onopen = () => {
      console.log(`[smoke] ${label}: socket open, sending start event`);
      ws.send(
        JSON.stringify({
          event: 'start',
          config: {
            input_format: 'pcm_16000',
            output_format: 'pcm_44100',
          },
          metadata: {
            user_id: 'smoke-test-user',
            coaching_style: 'warm',
            screen: 'onboard_01',
          },
        }),
      );
    };

    ws.onmessage = (msg) => {
      let data;
      try {
        data = JSON.parse(typeof msg.data === 'string' ? msg.data : msg.data.toString());
      } catch {
        console.log(`[smoke] ${label}: non-JSON frame (len=${msg.data?.length ?? '?'})`);
        return;
      }
      console.log(`[smoke] ${label}: event=${data.event}`, JSON.stringify(data).slice(0, 200));
      if (data.event === 'ack' && !settled) {
        cleanup();
        resolvePromise({ host, stream_id: data.stream_id, config: data.config });
      }
    };

    ws.onerror = (evt) => {
      console.log(`[smoke] ${label}: error event fired (browser-style event — no detail)`);
      if (evt?.message) console.log(`[smoke] ${label}: error.message=${evt.message}`);
    };

    ws.onclose = (evt) => {
      console.log(`[smoke] ${label}: closed code=${evt.code} reason="${evt.reason}"`);
      if (!settled) {
        cleanup();
        rejectPromise(new Error(`${label}: closed before ack (code=${evt.code})`));
      }
    };
  });
}

// ─── 3. Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('[smoke] minting agent access token…');
  const token = await mintAccessToken();
  console.log(`[smoke] token minted (len=${token.length})`);

  // Try primary host first, then fallback to the subdomain used in the Go
  // reference client (https://github.com/cartesia-ai/agent-ws-example).
  const hosts = [
    { host: 'api.cartesia.ai', label: 'primary' },
    { host: 'agents.cartesia.ai', label: 'fallback' },
  ];

  let lastErr;
  for (const h of hosts) {
    try {
      const result = await attemptConnection({ host: h.host, token, label: h.label });
      console.log(
        `\n[smoke] ✅ PASS — ${result.host} accepted query-param auth. stream_id=${result.stream_id}`,
      );
      process.exit(0);
    } catch (err) {
      console.log(`[smoke] ⚠ ${h.label} failed: ${err.message}`);
      lastErr = err;
    }
  }

  console.error(`\n[smoke] ❌ FAIL — both hosts rejected the connection.`);
  console.error(`[smoke] last error: ${lastErr?.message}`);
  console.error(`[smoke] next-step options:`);
  console.error(`        • Try Sec-WebSocket-Protocol subprotocol auth`);
  console.error(`        • Proxy through a backend (adds Authorization header server-side)`);
  console.error(`        • Contact Cartesia support for browser auth guidance`);
  process.exit(1);
}

main().catch((err) => {
  console.error(`[smoke] unexpected error: ${err.stack || err.message}`);
  process.exit(3);
});
