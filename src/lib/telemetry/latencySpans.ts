/**
 * Latency spans for the onboarding turn path (latency lane, T1).
 *
 * Measurement only: emitting a span must NEVER affect behavior. Every emit
 * guards against non-finite values and swallows its own failures, so preview
 * contexts (FlowCheckinPreview / FlowOnboardingPreview, no server session,
 * PostHog possibly uninitialized) cannot throw through a span call.
 *
 * All spans flow through the existing track() wrapper (src/analytics), which
 * already no-ops when PostHog is not initialized.
 */
import { track } from '@/analytics';

export type LatencySpanName =
  | 'llm_ttft_ms'
  | 'beat_transition_ms'
  | 'cartesia_first_audio_ms'
  | 'mp3_first_audio_ms'
  | 'vapi_first_audio_ms'
  | 'warmup_roundtrip_ms';

export function emitLatencySpan(
  span: LatencySpanName,
  ms: number,
  properties?: Record<string, unknown>,
): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  try {
    track(span, { ms: Math.round(ms), ...properties });
  } catch {
    // Telemetry must never break the flow.
  }
}

// --- beat_transition_ms stitching ------------------------------------------
// The transition's two client legs live in different hooks: the TRIGGER (a
// streamed tool event applying a step bump in useChatToolEvents, or a Supabase
// Realtime row receipt in useOnboardingRealtimeSync) and the COMMIT (the
// coach-driven applyAndAdvance in useFlowOrchestrator). A module-level pending
// mark carries the turn id across the gap. Single slot: transitions serialize
// in practice, and the Direct-LLM path can trigger BOTH marks for one
// transition (tool event first, then its own server write mirrored back via
// Realtime) — first-mark-wins keeps the earlier, truer start. A mark that
// never settles (e.g. routed-navigation path, no orchestrator) expires.
interface PendingBeatTransition {
  turnId: string;
  source: 'tool_event' | 'realtime';
  tool?: string;
  t0: number;
}
const TRANSITION_STALE_MS = 15_000;
let pendingTransition: PendingBeatTransition | null = null;

export function markBeatTransition(
  turnId: string,
  source: 'tool_event' | 'realtime',
  tool?: string,
): void {
  const now = performance.now();
  if (pendingTransition && now - pendingTransition.t0 < TRANSITION_STALE_MS) return;
  pendingTransition = { turnId, source, tool, t0: now };
}

export function settleBeatTransition(properties?: Record<string, unknown>): void {
  const pending = pendingTransition;
  pendingTransition = null;
  if (!pending) return;
  const ms = performance.now() - pending.t0;
  if (ms > TRANSITION_STALE_MS) return; // expired mark from an abandoned turn
  emitLatencySpan('beat_transition_ms', ms, {
    turn_id: pending.turnId,
    source: pending.source,
    ...(pending.tool ? { tool: pending.tool } : {}),
    ...properties,
  });
}
