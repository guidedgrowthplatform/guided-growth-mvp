import type { VoiceMessage } from '@/contexts/useOnboardingVoiceSession';

export type StartThreadMode = 'replace' | 'append-if-empty' | 'append' | 'sole-opener';

const OPENER_PREFIX = 'opener-';

export function applyStartThread(
  prev: VoiceMessage[],
  initial: VoiceMessage[],
  mode: StartThreadMode,
): VoiceMessage[] {
  if (mode === 'append') return [...prev, ...initial];
  if (mode === 'append-if-empty') return prev.length === 0 ? initial : prev;
  // Openers are per-screen prompts, not history: keep only the current one.
  if (mode === 'sole-opener') {
    const kept = prev.filter((m) => !m.id.startsWith(OPENER_PREFIX));
    return [...kept, ...initial];
  }
  return initial;
}
