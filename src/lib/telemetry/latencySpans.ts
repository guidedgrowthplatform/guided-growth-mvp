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
  | 'vapi_first_audio_ms';

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
