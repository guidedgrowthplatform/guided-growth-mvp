import { CHECKIN_TOOLS, type CheckinToolDefinition, type CheckinToolName } from './schemas.js';

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

// Check-in openers are tool-less EXCEPT for one read-only tool that surfaces the
// interactive card inline with the warm opener (so the user acts in the UI
// instead of a one-by-one chat interrogation):
//   evening (ECHECK-01) → query_habits  → today's-habits checklist
//   morning (MCHECK-01) → query_checkin → 4-scale sleep/mood/energy/stress card
const QUERY_HABITS_ONLY: readonly CheckinToolDefinition[] = CHECKIN_TOOLS.filter(
  (t) => t.name === 'query_habits',
);
const QUERY_CHECKIN_ONLY: readonly CheckinToolDefinition[] = CHECKIN_TOOLS.filter(
  (t) => t.name === 'query_checkin',
);
export function getCheckinOpenerTools(
  screenId: string | null | undefined,
): readonly CheckinToolDefinition[] | undefined {
  if (screenId === 'ECHECK-01') return QUERY_HABITS_ONLY;
  if (screenId === 'MCHECK-01') return QUERY_CHECKIN_ONLY;
  return undefined;
}

// Per-beat tool gating for the scripted check-in flows (the fix for the
// wrong-beat-write class, W2-C: at ONBOARD-STATE-CHECK an onboarding-side
// misfire skipped 3 beats — the same shape exists here, since MCHECK-01 and
// ECHECK-01 are pinned to one scripted flow each (see systemPromptAddendum.ts)
// but used to be handed the entire 15-tool CHECKIN_TOOLS array. Only
// HOME-CHECKIN is the genuinely open-ended always-on assistant that needs the
// full set.
//
// Derived from the scripted flow text itself (systemPromptAddendum.ts):
//   MCHECK-01 chat  → record_checkin is the only data tool buildMorningFlow
//                     ever asks for.
//   ECHECK-01 chat  → complete_habit (the habit walk) + log_reflection (the
//                     reflection) are the only data tools buildEveningWalkthrough
//                     ever asks for. update_reflection is deliberately NOT
//                     included — the comment in buildSystemPrompt.ts says that
//                     edit surface is for "HOME-CHECKIN free-form journaling +
//                     update_reflection edits" only, not the scripted evening walk.
// query_habits / get_summary are always allowed on both — the addendum
// (CHECKIN_TOOL_ADDENDUM) tells the model it can always answer "what are my
// habits" / "how was my week" read-only, and the opener tools already cover
// the inline-card read on entry.
const ALWAYS_ON_CHECKIN_TOOLS: readonly CheckinToolName[] = ['query_habits', 'get_summary'];
const SCRIPTED_BEAT_TOOLS: Readonly<Record<string, readonly CheckinToolName[]>> = {
  'MCHECK-01': ['record_checkin', ...ALWAYS_ON_CHECKIN_TOOLS],
  'ECHECK-01': ['complete_habit', 'log_reflection', ...ALWAYS_ON_CHECKIN_TOOLS],
};

function filterCheckinTools(names: readonly CheckinToolName[]): readonly CheckinToolDefinition[] {
  const set = new Set<string>(names);
  return CHECKIN_TOOLS.filter((t) => set.has(t.name));
}

export function getCheckinTools(
  screenId: string | null | undefined,
  mode?: 'chat' | 'opener',
): readonly CheckinToolDefinition[] | undefined {
  if (!isCheckinScreen(screenId)) return undefined;
  // HOME-CHECKIN is the free-form always-on assistant — full set, every mode.
  if (screenId === 'HOME-CHECKIN') return CHECKIN_TOOLS;
  // Opener turns are handled by getCheckinOpenerTools (a single read-only
  // card tool); getCheckinTools is only consulted for chat-mode turns on
  // MCHECK-01 / ECHECK-01, but gate defensively regardless of caller order.
  const scripted = SCRIPTED_BEAT_TOOLS[screenId as string];
  if (scripted === undefined) return CHECKIN_TOOLS; // graceful fallback, never brick a screen
  if (mode === 'opener') return filterCheckinTools(ALWAYS_ON_CHECKIN_TOOLS);
  return filterCheckinTools(scripted);
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

// Screens where the coach may read the user's calendar events. Excludes
// onboarding (unscrubbed PII path, Gotcha #8).
export function shouldReadCalendarForContext(screenId: string | null | undefined): boolean {
  return isCheckinScreen(screenId) || isReadOnlyCheckinScreen(screenId);
}

// Returns the read-only check-in tools (query_habits, get_summary) for the
// screens isReadOnlyCheckinScreen accepts.
export function getReadOnlyCheckinTools(
  screenId: string | null | undefined,
): readonly CheckinToolDefinition[] | undefined {
  return isReadOnlyCheckinScreen(screenId) ? READONLY_CHECKIN_TOOLS : undefined;
}
