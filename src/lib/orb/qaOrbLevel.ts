/**
 * qaOrbLevel — B51 QA seam: exposes window.__ggQaOrbLevel(), returning the
 * orb's current resolved mic amplitude `{ source, amp }`, so a Playwright/
 * preview-eval driver can sample real amp values during a live coach/user
 * turn without any UI change for real users. Same gate and shape convention
 * as qaConvoHarness.ts (QA_SCREEN_ENABLED builds only).
 */
import { QA_SCREEN_ENABLED } from '@/onboarding-flow/qaConvoHarness';

type QaOrbLevelSource = 'coach' | 'user' | 'idle';

export interface QaOrbLevel {
  source: QaOrbLevelSource;
  amp: number;
}

declare global {
  interface Window {
    __ggQaOrbLevel?: () => QaOrbLevel;
  }
}

/** Register the getter. Returns an unregister function (mirrors registerQaSendUserTurn). */
export function registerQaOrbLevel(getLevel: () => QaOrbLevel): () => void {
  if (!QA_SCREEN_ENABLED || typeof window === 'undefined') return () => {};
  window.__ggQaOrbLevel = getLevel;
  return () => {
    if (window.__ggQaOrbLevel === getLevel) delete window.__ggQaOrbLevel;
  };
}
