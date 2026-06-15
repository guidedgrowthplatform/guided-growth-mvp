import type { SessionStateDeltaEntry } from '@gg/shared/types/context';

const MAX_ENTRIES = 100;
const MAX_BYTES = 50_000;

// Client-supplied state delta is untrusted: cap size and check structure before it
// feeds the system prompt. Returns the validated slice, or an error message.
export function validateRecentEvents(
  raw: unknown,
): { ok: true; events: SessionStateDeltaEntry[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: 'recent_events must be an array' };
  if (raw.length > MAX_ENTRIES) return { ok: false, error: 'recent_events too large' };
  if (JSON.stringify(raw).length > MAX_BYTES)
    return { ok: false, error: 'recent_events too large' };

  const events: SessionStateDeltaEntry[] = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') return { ok: false, error: 'recent_events entry malformed' };
    const x = e as Record<string, unknown>;
    if (typeof x.id !== 'string' || x.id.length === 0)
      return { ok: false, error: 'recent_events entry malformed' };
    if (typeof x.session_id !== 'string' || x.session_id.length === 0)
      return { ok: false, error: 'recent_events entry malformed' };
    if (typeof x.event_type !== 'string' || x.event_type.length === 0)
      return { ok: false, error: 'recent_events entry malformed' };
    if (typeof x.timestamp !== 'string' || Number.isNaN(Date.parse(x.timestamp)))
      return { ok: false, error: 'recent_events entry malformed' };
    if (x.screen_id !== null && typeof x.screen_id !== 'string')
      return { ok: false, error: 'recent_events entry malformed' };
    if (x.payload !== null && (typeof x.payload !== 'object' || Array.isArray(x.payload)))
      return { ok: false, error: 'recent_events entry malformed' };
    events.push(x as unknown as SessionStateDeltaEntry);
  }
  return { ok: true, events };
}
