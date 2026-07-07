// Pre-mints the Soniox temp key AND pre-opens the WebSocket at mic-permission
// -grant time — before the user has spoken a word. Same warm-ahead philosophy
// as fireWarmup() (src/lib/services/warmup.ts) and the clip prefetch.
//
// QA harness (MR !457) measured Soniox time-to-first-partial p50 at 1224ms
// while the STT pipe itself only costs ~190-205ms. The rest is paid AFTER the
// user starts speaking: KEY MINTING (521-1485ms, via openSocket() in
// soniox-stream.ts awaiting takeTempKey()) and WS OPEN (~490-600ms, the
// WebSocket handshake to Soniox). Both can be moved earlier — to the
// mic-permission-grant moment, which happens well before the user speaks —
// without changing when the paid session (audio flowing, billable) starts.
//
// Key half: reuses soniox-temp-key-cache's own mint path (prefetchTempKey),
// so this does not duplicate cache logic — it just makes sure the cache is
// warm at a moment earlier than "mic armed" (see startKeyWarmLoop callers),
// which today races the very first utterance's key mint.
//
// Socket half: pre-opens a real WebSocket to Soniox and holds it, unclaimed,
// for handoff to the next real session. This is a deliberate "hold" design
// (not handshake-only): the SonioxSocket abstraction has no way to keep a
// live connection open without it being fully upgraded, and a fully-upgraded
// idle WS is exactly what saves ws_ms when claimed. The tradeoff — holding an
// unclaimed, silent socket open has unknown server-side billing/idle-timeout
// semantics — is bounded by PREWARM_SOCKET_TTL_MS: if unclaimed by then, the
// socket is closed and discarded. Nothing is ever sent on it (no start
// message, no audio) until a real session claims it, so it never becomes a
// billable/transcribing session on its own.
import { SONIOX_PREWARM } from '@/config/voiceConfig';
import type { SonioxSocket } from '@/lib/services/soniox-stream';
import { prefetchTempKey } from '@/lib/services/soniox-temp-key-cache';

// Owned here (not imported from soniox-stream.ts) so this module has no
// runtime dependency on it — soniox-stream.ts imports FROM this file
// (claimPrewarmedSocket), so the reverse direction would be circular.
// soniox-stream.ts's own SONIOX_WS_URL must stay in sync with this constant.
export const SONIOX_WS_URL = 'wss://stt-rt.soniox.com/transcribe-websocket';

// Self-expiry for an unclaimed pre-opened socket. Long enough to cover the
// realistic mic-permission-grant -> first-utterance gap, short enough to
// bound how long we hold an idle connection against unknown server-side
// idle-timeout/billing semantics.
const PREWARM_SOCKET_TTL_MS = 20_000;

interface PrewarmedSocket {
  socket: SonioxSocket;
  openedAt: number;
  opened: boolean;
  expireHandle: ReturnType<typeof setTimeout>;
}

let pending: PrewarmedSocket | null = null;

// Native-WebSocket -> SonioxSocket adapter, readyState-aware so a socket
// that's ALREADY open by the time something calls onOpen() still fires the
// callback (native WebSocket.onopen is a one-shot property; assigning it
// after 'open' has already fired never calls back). This is what lets a
// prewarmed socket — opened long before a real session claims it — satisfy
// createSonioxSession's `sock.onOpen(cb)` contract identically to a fresh one.
function wrapWebSocket(ws: WebSocket): SonioxSocket {
  return {
    send: (data) => ws.send(data as string | ArrayBufferLike),
    close: () => ws.close(),
    onOpen: (cb) => {
      if (ws.readyState === WebSocket.OPEN) {
        queueMicrotask(cb);
        return;
      }
      ws.onopen = () => cb();
    },
    onMessage: (cb) => {
      ws.onmessage = (ev: MessageEvent) => {
        if (typeof ev.data === 'string') cb(ev.data);
        else if (ev.data instanceof ArrayBuffer) cb(new TextDecoder().decode(ev.data));
      };
    },
    onError: (cb) => {
      ws.onerror = (e) => cb(e);
    },
    onClose: (cb) => {
      ws.onclose = (e: CloseEvent) => cb(e.code);
    },
  };
}

// Exported so soniox-stream.ts's cold-open path uses the exact same
// WebSocket wrapper a claimed prewarmed socket already used — a claimed
// socket and a freshly-opened one must be indistinguishable to the caller.
export function openRealSonioxSocket(url: string): SonioxSocket {
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  return wrapWebSocket(ws);
}

// Overridable for tests; production uses openRealSonioxSocket (real WebSocket).
export type SocketOpener = (url: string) => SonioxSocket;
let socketOpener: SocketOpener = openRealSonioxSocket;

export function setPrewarmSocketOpener(opener: SocketOpener | null): void {
  socketOpener = opener ?? openRealSonioxSocket;
}

function clearPending(): void {
  if (pending) {
    clearTimeout(pending.expireHandle);
    pending = null;
  }
}

function discardPending(reason: string): void {
  void reason; // kept for readability at call sites; no logging path today
  if (!pending) return;
  const stale = pending;
  pending = null;
  clearTimeout(stale.expireHandle);
  try {
    stale.socket.close();
  } catch {
    /* noop */
  }
}

/**
 * Pre-open a WebSocket to Soniox and hold it unclaimed. Never sends the
 * start message or any audio — that only happens once a real session claims
 * it via claimPrewarmedSocket(). Self-expires after PREWARM_SOCKET_TTL_MS.
 */
function prewarmSocket(): void {
  // Already have a live, unexpired, unclaimed socket — nothing to do.
  if (pending) return;

  let sock: SonioxSocket;
  try {
    sock = socketOpener(SONIOX_WS_URL);
  } catch {
    return;
  }

  const entry: PrewarmedSocket = {
    socket: sock,
    openedAt: performance.now(),
    opened: false,
    expireHandle: setTimeout(() => {
      // Still unclaimed at TTL — close and drop it; the next real session
      // falls back to opening its own socket exactly as it does today.
      discardPending('ttl');
    }, PREWARM_SOCKET_TTL_MS),
  };
  pending = entry;

  sock.onOpen(() => {
    if (pending !== entry) return; // already claimed or discarded
    entry.opened = true;
  });
  // A pre-opened socket that errors or closes on its own (idle-kick, network
  // blip) before anyone claims it is just discarded — the next real session
  // falls back to its own openSocket() call, same as prewarm-off behavior.
  sock.onError(() => {
    if (pending === entry) discardPending('error');
  });
  sock.onClose(() => {
    if (pending === entry) discardPending('close');
  });
}

/**
 * Claim the pending pre-opened, already-OPEN socket if one is fresh and
 * ready. Returns null (never throws) when there is nothing to claim — the
 * caller falls back to opening its own socket, identical to prewarm-off
 * behavior. Consumes the pending slot either way it's inspected as "claimed".
 */
export function claimPrewarmedSocket(): SonioxSocket | null {
  if (!pending) return null;
  const entry = pending;
  // Not yet upgraded (still mid-handshake) — not safe to hand off through the
  // onOpen-based API a fresh session expects to fire; let it expire/close on
  // its own and fall back to a cold open for this session.
  if (!entry.opened) {
    discardPending('not-open-yet');
    return null;
  }
  pending = null;
  clearTimeout(entry.expireHandle);
  return entry.socket;
}

/** True when a fresh, already-open socket is waiting to be claimed. */
export function hasPrewarmedSocket(): boolean {
  return pending !== null && pending.opened;
}

/**
 * Fire-and-forget prewarm: mints a fresh temp key into the shared cache and
 * (best-effort) pre-opens the Soniox WebSocket. Guarded by SONIOX_PREWARM;
 * callers must not await this on any user-facing path — errors are always
 * swallowed and it must never block the mic-permission-grant flow.
 */
export function prewarmSoniox(): void {
  if (!SONIOX_PREWARM) return;
  try {
    prefetchTempKey();
  } catch {
    /* never block the caller */
  }
  try {
    prewarmSocket();
  } catch {
    /* never block the caller */
  }
}

export function __resetSonioxPrewarmForTest(): void {
  discardPending('test-reset');
  clearPending();
  socketOpener = openRealSonioxSocket;
}
