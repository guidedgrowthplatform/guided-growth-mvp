/**
 * qaConvoHarness - test seam for the conversational QA harness (gg-spec
 * tools/convo-harness). QA_SCREEN_ENABLED builds only (same gate as
 * /onboarding/qa: VITE_QA_SCREEN_ENABLED=true or DEV).
 *
 * Exposes window.__ggQaSendUserTurn(text), which drives the exact same
 * sendUserTurn() path a voice transcript final feeds into useOnboardingChat.
 * No UI change, no behavior change for real users -- this only registers a
 * function on `window` so an external Playwright driver can inject text
 * turns on beats that have no visible text composer (chat-native flow route
 * renders cards + orb, not the floating ChatComposer).
 */
export const QA_SCREEN_ENABLED =
  import.meta.env.VITE_QA_SCREEN_ENABLED === 'true' || import.meta.env.DEV;

declare global {
  interface Window {
    __ggQaSendUserTurn?: (text: string) => void;
  }
}

export function registerQaSendUserTurn(sendUserTurn: (text: string) => void): () => void {
  if (!QA_SCREEN_ENABLED || typeof window === 'undefined') return () => {};
  window.__ggQaSendUserTurn = sendUserTurn;
  return () => {
    if (window.__ggQaSendUserTurn === sendUserTurn) delete window.__ggQaSendUserTurn;
  };
}
