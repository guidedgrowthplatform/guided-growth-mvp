// One chat_session_id for the whole onboarding journey.
// sessionStorage: survives in-tab refresh, clears on tab close.

const ONBOARDING_CHAT_SESSION_KEY = 'gg_onboarding_chat_session_id';

// In-memory fallback for private-browsing / storage-throw.
let memoryFallbackId: string | null = null;

export function getOrCreateOnboardingChatSessionId(): string {
  try {
    const existing = sessionStorage.getItem(ONBOARDING_CHAT_SESSION_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(ONBOARDING_CHAT_SESSION_KEY, fresh);
    return fresh;
  } catch {
    if (!memoryFallbackId) memoryFallbackId = crypto.randomUUID();
    return memoryFallbackId;
  }
}

export function clearOnboardingChatSessionId(): void {
  memoryFallbackId = null;
  try {
    sessionStorage.removeItem(ONBOARDING_CHAT_SESSION_KEY);
  } catch {
    // best-effort
  }
}
