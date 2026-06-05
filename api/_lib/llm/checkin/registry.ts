import { CHECKIN_TOOLS, type CheckinToolDefinition } from './schemas.js';

// Allowlist of check-in conversation entry screens; a HOME- prefix would wrongly catch dashboard screens.
const CHECKIN_SCREEN_IDS: ReadonlySet<string> = new Set(['HOME-CHECKIN', 'MCHECK-01', 'ECHECK-01']);

export function isCheckinScreen(screenId: string | null | undefined): boolean {
  return typeof screenId === 'string' && CHECKIN_SCREEN_IDS.has(screenId);
}

export function getCheckinTools(
  screenId: string | null | undefined,
): readonly CheckinToolDefinition[] | undefined {
  return isCheckinScreen(screenId) ? CHECKIN_TOOLS : undefined;
}
