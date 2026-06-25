import type { OnboardingVoiceStatus } from '@/contexts/useOnboardingVoiceSession';
import type { RealtimeVoiceState } from '@/hooks/useRealtimeVoice';

/**
 * Pure derivation of "should the 8s idle auto-pause timer be armed right now?".
 *
 * Lifted out of OnboardingVoiceProvider so the arm decision (especially the
 * instant-opener conjunct) is unit-testable without rendering the provider.
 *
 * The timer must arm only once the coach has actually spoken and the call is
 * idling in the listening phase, otherwise we'd pause a call before the coach
 * even greeted the user. "Has spoken" is satisfied by EITHER:
 *   - Vapi's own TTS firing (speech-start -> state==='speaking'), the normal
 *     warm-beat path, OR
 *   - the instant Cartesia opener finishing (ONBOARDING_INSTANT_OPENER), where
 *     Vapi joins silent (firstMessageMode='assistant-waits-for-user') so its
 *     speech-start never fires. Without folding the opener in here, the FIRST
 *     Vapi-covered chat-native beat never armed the timer, so an idle user left
 *     the live Vapi call burning voice minutes forever.
 */
export interface IdleTimerGateInput {
  status: OnboardingVoiceStatus;
  state: RealtimeVoiceState;
  assistantHasSpoken: boolean;
}

export function shouldArmIdleTimer(input: IdleTimerGateInput): boolean {
  return input.status === 'active' && input.state === 'listening' && input.assistantHasSpoken;
}

/**
 * Remaining time (ms) until the idle auto-pause should fire, measured as
 * CONTINUOUS USER silence: timeoutMs minus how long it's been since the last
 * real user activity (`lastUserActivityAt`, a wall-clock timestamp).
 *
 * This is the arithmetic that makes the auto-pause survive Vapi's own idle
 * re-prompt. The provider re-arms the timer every time Vapi bounces
 * listening→speaking→listening (the assistant nudging a quiet user), but the
 * delay is computed from the last USER turn, not from when the listening window
 * reopened. So a re-prompt at ~7.5s no longer restarts a fresh 8s window — it
 * schedules for the small leftover, and genuine user silence still reaches the
 * threshold and pauses. Clamped to >= 0 (a long-overdue window fires now).
 */
export function idleSilenceRemainingMs(
  lastUserActivityAt: number,
  now: number,
  timeoutMs: number,
): number {
  return Math.max(0, timeoutMs - (now - lastUserActivityAt));
}

/**
 * True once `timeoutMs` of continuous user silence has elapsed since
 * `lastUserActivityAt` — i.e. the call really is idle and should auto-pause.
 * When false, the caller should reschedule for the leftover rather than pause
 * (the user spoke since the timer was armed). This is the gate the fired timer
 * re-checks so a user turn that lands inside the window can't be paused over.
 */
export function isUserSilenceElapsed(
  lastUserActivityAt: number,
  now: number,
  timeoutMs: number,
): boolean {
  return now - lastUserActivityAt >= timeoutMs;
}
