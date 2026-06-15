// Bootstrap cache only — onboarding_states.chat_session_id is authoritative on
// resume. localStorage (not sessionStorage) so it survives tab close.

const ONBOARDING_CHAT_SESSION_KEY = 'gg_onboarding_chat_session_id';

let memoryFallbackId: string | null = null;

export function getOrCreateOnboardingChatSessionId(): string {
  try {
    const existing = localStorage.getItem(ONBOARDING_CHAT_SESSION_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(ONBOARDING_CHAT_SESSION_KEY, fresh);
    return fresh;
  } catch {
    if (!memoryFallbackId) memoryFallbackId = crypto.randomUUID();
    return memoryFallbackId;
  }
}

// Seed the cache from the server-authoritative id (read on resume).
export function setOnboardingChatSessionId(id: string): void {
  memoryFallbackId = id;
  try {
    localStorage.setItem(ONBOARDING_CHAT_SESSION_KEY, id);
  } catch {
    // best-effort
  }
}

export function clearOnboardingChatSessionId(): void {
  memoryFallbackId = null;
  try {
    localStorage.removeItem(ONBOARDING_CHAT_SESSION_KEY);
  } catch {
    // best-effort
  }
}
