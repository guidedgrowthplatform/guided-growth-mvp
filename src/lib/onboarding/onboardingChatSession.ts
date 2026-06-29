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

// Adopt a server-resolved session id ONLY when this tab hasn't already minted one
// — overriding a session the tab is mid-write on would split the thread. Lets a
// fresh tab / new device continue the canonical onboarding thread (cross-device).
export function adoptOnboardingChatSessionId(id: string): void {
  try {
    if (sessionStorage.getItem(ONBOARDING_CHAT_SESSION_KEY)) return;
    sessionStorage.setItem(ONBOARDING_CHAT_SESSION_KEY, id);
  } catch {
    if (!memoryFallbackId) memoryFallbackId = id;
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
