import type { VoiceMessage } from '@/contexts/useOnboardingVoiceSession';

// localStorage persistence for the onboarding chat thread (the live transcript:
// opener + every user/coach turn). Keyed by anon_id so a genuine user switch
// never leaks the prior thread. Lets the conversation survive a refresh instead
// of living only in memory.

const KEY = (anonId: string) => `mvp03_onboarding_thread_${anonId}`;
const MAX = 200; // cap retained turns (matches the session_log store cap)

export function loadThread(anonId: string): VoiceMessage[] {
  try {
    const raw = localStorage.getItem(KEY(anonId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VoiceMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveThread(anonId: string, messages: VoiceMessage[]): void {
  try {
    localStorage.setItem(KEY(anonId), JSON.stringify(messages.slice(-MAX)));
  } catch {
    // best-effort (quota / private mode): the thread just won't survive refresh.
  }
}

export function clearThread(anonId: string): void {
  try {
    localStorage.removeItem(KEY(anonId));
  } catch {
    /* ignore */
  }
}
