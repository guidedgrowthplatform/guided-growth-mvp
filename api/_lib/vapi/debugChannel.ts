import { redactArgs } from '../sentry.js';

// Live Vapi tool-call telemetry to the user's browser devtools via Supabase
// Realtime broadcast — no table, no migration, fire-and-forget. The Vapi WebRTC
// session carries audio only, so this is the sole live window into webhook tool
// outcomes (success AND failure) from the client side.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface VapiToolEvent {
  anonId: string;
  callId: string;
  tool: string;
  ok: boolean;
  errorCode?: string;
  args?: unknown;
}

// Topic is keyed by anon_id (unguessable UUID); args are PII-redacted before send.
export function broadcastVapiToolEvent(evt: VapiToolEvent): Promise<void> {
  if (!url || !key || !evt.anonId || evt.anonId === 'missing') return Promise.resolve();
  return fetch(`${url}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `vapi-debug:${evt.anonId}`,
          event: 'tool_event',
          payload: {
            tool: evt.tool,
            ok: evt.ok,
            error_code: evt.errorCode ?? null,
            call_id: evt.callId,
            args: redactArgs(evt.args),
            ts: new Date().toISOString(),
          },
        },
      ],
    }),
  })
    .then(() => undefined)
    .catch(() => undefined); // telemetry must not break the tool loop
}
