import type { VoiceMessage } from '@/contexts/useOnboardingVoiceSession';

export function applyStartThread(
  prev: VoiceMessage[],
  initial: VoiceMessage[],
  mode: 'replace' | 'append-if-empty',
): VoiceMessage[] {
  if (mode === 'append-if-empty') return prev.length === 0 ? initial : prev;
  return initial;
}
