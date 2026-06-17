import { CHECKIN_TOOLS, type CheckinToolDefinition } from './schemas.js';

// Allowlist of check-in conversation entry screens; a HOME- prefix would wrongly catch dashboard screens.
const CHECKIN_SCREEN_IDS: ReadonlySet<string> = new Set(['HOME-CHECKIN', 'MCHECK-01', 'ECHECK-01']);

// Read-only subset surfaced on dashboard / chat screens so the coach can answer
// "what are my habits?" / "how was my week?" without exposing write tools.
const READONLY_TOOL_NAMES = new Set(['query_habits', 'get_summary']);
const READONLY_CHECKIN_TOOLS: readonly CheckinToolDefinition[] = CHECKIN_TOOLS.filter((t) =>
  READONLY_TOOL_NAMES.has(t.name),
);

export function isCheckinScreen(screenId: string | null | undefined): boolean {
  return typeof screenId === 'string' && CHECKIN_SCREEN_IDS.has(screenId);
}

export function getCheckinTools(
  screenId: string | null | undefined,
): readonly CheckinToolDefinition[] | undefined {
  return isCheckinScreen(screenId) ? CHECKIN_TOOLS : undefined;
}

// True on home/dashboard + check-in-family screens where the user is chatting
// but not on a dedicated check-in screen. Scoped to HOME/MCHECK/ECHECK so the
// "always call query_habits/get_summary" nudge does NOT leak onto unrelated
// screens (splash, auth, settings, insights) and trigger spurious tool calls
// (MR#6). Dedicated check-in screens get the full CHECKIN_TOOLS instead.
export function isReadOnlyCheckinScreen(screenId: string | null | undefined): boolean {
  if (typeof screenId !== 'string' || screenId === '') return false;
  if (CHECKIN_SCREEN_IDS.has(screenId)) return false;
  return (
    screenId.startsWith('HOME') || screenId.startsWith('MCHECK') || screenId.startsWith('ECHECK')
  );
}

// Returns the read-only check-in tools (query_habits, get_summary) for the
// screens isReadOnlyCheckinScreen accepts.
export function getReadOnlyCheckinTools(
  screenId: string | null | undefined,
): readonly CheckinToolDefinition[] | undefined {
  return isReadOnlyCheckinScreen(screenId) ? READONLY_CHECKIN_TOOLS : undefined;
}
