import type { VoiceMessage } from '@/contexts/useOnboardingVoiceSession';

export type StartThreadMode = 'replace' | 'append-if-empty' | 'append' | 'append-if-absent';

export function applyStartThread(
  prev: VoiceMessage[],
  initial: VoiceMessage[],
  mode: StartThreadMode,
): VoiceMessage[] {
  if (mode === 'append') return [...prev, ...initial];
  if (mode === 'append-if-empty') return prev.length === 0 ? initial : prev;
  if (mode === 'append-if-absent') {
    const ids = new Set(prev.map((m) => m.id));
    const fresh = initial.filter((m) => !ids.has(m.id));
    return fresh.length === 0 ? prev : [...prev, ...fresh];
  }
  return initial;
}
