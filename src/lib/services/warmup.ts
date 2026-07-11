import { Capacitor } from '@capacitor/core';
import { apiBaseOverride } from '@/lib/apiBase';
import { emitLatencySpan } from '@/lib/telemetry/latencySpans';

// Fire-and-forget warmup: hit the LLM function + Cartesia TTS function once at
// app open so the serverless function and the pg pool (max:1, ~2.8s cold
// pooler connect — see api/_lib/db.ts) are already warm by the time the
// user's first real opener fires (several seconds later, after login/home
// render). Never blocks render, never throws, never surfaces to the user.

// Same base-URL resolution as src/api/llm.ts's getApiUrl — native builds hit
// the deployed API via VITE_API_URL, web serves same-origin, unless
// VITE_API_BASE overrides it on either platform.
function getApiUrl(): string {
  const override = apiBaseOverride();
  if (override) return override;
  if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  }
  return '';
}

let fired = false;

export function fireWarmup(): void {
  if (fired) return;
  fired = true;

  const startedAt = performance.now();
  fetch(`${getApiUrl()}/api/llm/warmup`, { method: 'GET', keepalive: true })
    .then(async (res) => {
      const roundtripMs = performance.now() - startedAt;
      let db_ms: number | undefined;
      try {
        const body = (await res.json()) as { warm?: boolean; db_ms?: number };
        if (typeof body.db_ms === 'number') db_ms = body.db_ms;
      } catch {
        // ignore malformed body — still emit the roundtrip we measured
      }
      emitLatencySpan('warmup_roundtrip_ms', roundtripMs, { db_ms });
    })
    .catch(() => {
      // best-effort — a failed warmup must never surface to the user
    });

  fetch(`${getApiUrl()}/api/cartesia-tts`, { method: 'GET', keepalive: true }).catch(() => {});
}
