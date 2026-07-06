/**
 * qaConvoHarness - test seam for the conversational QA harness (gg-spec
 * tools/convo-harness). QA_SCREEN_ENABLED builds only (same gate as
 * /onboarding/qa: VITE_QA_SCREEN_ENABLED=true or DEV).
 *
 * Exposes window.__ggQaSendUserTurn(text), which drives the same
 * sendUserTurn()/sendText() a voice transcript final feeds into
 * useOnboardingChat / useCoachChat. No UI change, no behavior change for real
 * users -- this only registers a function on `window` so an external
 * Playwright driver can inject text turns on beats/screens that have no
 * visible text composer (the onboarding chat-native flow route renders cards
 * + an orb, not the floating ChatComposer; same idea applies to the home
 * check-in surface).
 *
 * Two callers register here: OnboardingVoiceProvider (onboarding beats,
 * screen ids starting ONBOARD-) and CoachVoiceProvider (home/check-in,
 * HOME-CHECKIN / MCHECK-* / ECHECK-*). Both can be mounted at once (the
 * onboarding provider wraps the whole app; the coach provider mounts once the
 * user reaches home), so this is a keyed registry, not a single slot -- each
 * caller registers under its own key and the harness picks by CURRENT screen
 * via window.__ggQaActiveKey, defaulting to whichever key registered last.
 */
export const QA_SCREEN_ENABLED =
  import.meta.env.VITE_QA_SCREEN_ENABLED === 'true' || import.meta.env.DEV;

export type QaSendUserTurnKey = 'onboarding' | 'coach';

declare global {
  interface Window {
    __ggQaSendUserTurn?: (text: string) => void;
    __ggQaSendUserTurnByKey?: Partial<Record<QaSendUserTurnKey, (text: string) => void>>;
  }
}

export function registerQaSendUserTurn(
  key: QaSendUserTurnKey,
  sendUserTurn: (text: string) => void,
): () => void {
  if (!QA_SCREEN_ENABLED || typeof window === 'undefined') return () => {};
  window.__ggQaSendUserTurnByKey = window.__ggQaSendUserTurnByKey ?? {};
  window.__ggQaSendUserTurnByKey[key] = sendUserTurn;
  // Back-compat single-slot pointer: last registration wins, which is fine
  // because the two callers are mutually exclusive in practice (onboarding
  // vs. post-onboarding home) even though both providers are always mounted.
  window.__ggQaSendUserTurn = sendUserTurn;
  return () => {
    if (window.__ggQaSendUserTurnByKey?.[key] === sendUserTurn) {
      delete window.__ggQaSendUserTurnByKey[key];
    }
    if (window.__ggQaSendUserTurn === sendUserTurn) delete window.__ggQaSendUserTurn;
  };
}
