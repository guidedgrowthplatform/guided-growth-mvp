import pool from '../db.js';
import { buildSystemPrompt, PRODUCT_CONTEXT } from '@gg/shared/coaching/systemPrompt';
import type { CoachingStyle } from '@gg/shared/coaching/styles';
import { buildContextMessage } from '@gg/shared/context/buildContextMessage';
import type { SessionStateDeltaEntry } from '@gg/shared/types/context';
import { buildCanonicalOptionsBlock } from './onboarding/canonicalOptions.js';
import { ONBOARDING_TOOL_ADDENDUM } from './onboarding/systemPromptAddendum.js';
import { stripForwardPointers } from './stripForwardPointers.js';
import { NO_PRENARRATION_RULE } from './noPrenarrationRule.js';
import { NO_INTERNAL_NARRATION_RULE } from './noInternalNarrationRule.js';
import { CONVERSATIONAL_SURFACE_RULE } from './conversationalSurfaceRule.js';
import {
  CHECKIN_TOOL_ADDENDUM,
  CHECKIN_READONLY_ADDENDUM,
  buildEveningWalkthrough,
  buildEveningOpener,
  buildMorningOpener,
  buildMorningFlow,
  buildScriptedDiscipline,
} from './checkin/systemPromptAddendum.js';
import { isCheckinScreen, isReadOnlyCheckinScreen } from './checkin/registry.js';
import { todayStr } from './checkin/handlers/shared.js';
import { bucketTimeOfDay, localHour } from '@gg/shared/time/bucketTimeOfDay';
import { readReflectionSettings } from '../reflection/reflectionSettings.js';
import { DEFAULT_REFLECTION_PROMPTS } from '@gg/shared/types';

export interface BuildSystemPromptArgs {
  anon_id: string;
  screen_id: string;
  coaching_style: CoachingStyle;
  // Optimistic state_delta from the client. When provided, used instead of
  // querying session_log — avoids the race where a logEvent POST hasn't
  // landed before the LLM call.
  recent_events?: SessionStateDeltaEntry[];
  mode?: 'chat' | 'opener';
  timezone?: string;
  // Absent → treated as 'text' (text phrasing is channel-safe; voice phrasing
  // wrongly tells a typer to tap/speak — GitLab #217).
  input_mode?: 'voice' | 'text';
}

export interface BuildSystemPromptResult {
  systemPrompt: string;
  contextVersion: number;
  deltaCount: number;
}

interface ScreenRow {
  context_block: string;
  version: number;
}

interface SessionLogRow {
  id: string;
  session_id: string;
  timestamp: Date;
  event_type: string;
  screen_id: string | null;
  payload: Record<string, unknown> | null;
}

export async function buildSystemPromptForRequest(
  args: BuildSystemPromptArgs,
): Promise<BuildSystemPromptResult> {
  const screenRes = await pool.query<ScreenRow>(
    `SELECT context_block, version FROM screen_contexts WHERE screen_id = $1`,
    [args.screen_id],
  );
  // Missing row (un-seeded env) → generic block, not a 404 that breaks every chat user.
  let screen: ScreenRow;
  if (screenRes.rowCount === 0) {
    console.warn(
      `[buildSystemPrompt] no screen_contexts row for "${args.screen_id}" — using generic fallback`,
    );
    screen = { context_block: FALLBACK_CONTEXT_BLOCK, version: 0 };
  } else {
    screen = screenRes.rows[0];
  }

  let state_delta: SessionStateDeltaEntry[];
  if (args.recent_events && args.recent_events.length > 0) {
    // Client supplied optimistic delta — use directly. Strip llm_call rows
    // to match the server-query behavior below.
    state_delta = args.recent_events.filter((e) => e.event_type !== 'llm_call').slice(-15);
  } else {
    // No client delta — fall back to live session_log query, scoped by anon_id
    // per P1-21 anonymization architecture.
    const logRes = await pool.query<SessionLogRow>(
      `SELECT id, session_id, timestamp, event_type, screen_id, payload
         FROM session_log
        WHERE anon_id = $1 AND event_type <> 'llm_call'
        ORDER BY timestamp DESC
        LIMIT 15`,
      [args.anon_id],
    );
    state_delta = logRes.rows
      .map((r) => ({
        id: r.id,
        session_id: r.session_id,
        timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
        event_type: r.event_type,
        screen_id: r.screen_id,
        payload: r.payload,
      }))
      .reverse();
  }

  // Anonymization policy: only coaching_style flows into the preamble.
  // Do NOT hydrate UserContext.name / email / last_name from profiles —
  // the LLM gets first_name only via the AI Context Block on screens
  // where it's already part of the prompt.
  const isOnboardingScreen = args.screen_id.startsWith('ONBOARD-');

  const coachingPreamble = buildSystemPrompt({ coachingStyle: args.coaching_style });
  // Direct-LLM only — Vapi keeps raw context elsewhere (it drives navigation).
  // advance_step is the Direct-LLM nav tool; the shared bundle says navigate_next (Vapi's name).
  const contextBlock = stripForwardPointers(screen.context_block).replace(
    /navigate_next/g,
    'advance_step',
  );
  const contextMessage = buildContextMessage({
    screen_id: args.screen_id,
    context_block: contextBlock,
    state_delta,
  });

  // Product Q&A only off onboarding — keeps the coach from volunteering
  // feature/cap/founding info mid-onboarding.
  const productBlock = isOnboardingScreen ? '' : `\n\n${PRODUCT_CONTEXT}`;
  const onboardingNudge = isOnboardingScreen ? `\n\n${ONBOARDING_TOOL_ADDENDUM}` : '';
  const isCheckin = isCheckinScreen(args.screen_id);
  const checkinNudge = isCheckin ? `\n\n${CHECKIN_TOOL_ADDENDUM}` : '';
  // Read-only screens excludes the dedicated 3, so this never co-emits with checkinNudge.
  const readonlyNudge = isReadOnlyCheckinScreen(args.screen_id)
    ? `\n\n${CHECKIN_READONLY_ADDENDUM}`
    : '';
  const timeBlock = isCheckin ? buildCurrentTimeBlock(args.timezone) : '';
  // Scripted lines rotate per local day (stable all day). Invalid/missing tz
  // falls back to UTC rather than throwing (mirrors buildCurrentTimeBlock).
  let daySeed: string;
  try {
    daySeed = todayStr(args.timezone);
  } catch {
    daySeed = todayStr('UTC');
  }
  // Evening flow (habits → gate → fixed reflection → wrap), scripted; all ECHECK turns.
  const walkthroughBlock =
    args.screen_id === 'ECHECK-01' ? `\n\n${buildEveningWalkthrough(daySeed)}` : '';
  // Morning flow (are-you-done gate + wrap), scripted; all MCHECK turns.
  const morningFlowBlock = args.screen_id === 'MCHECK-01' ? `\n\n${buildMorningFlow(daySeed)}` : '';
  // Hard no-improvisation rule on the dedicated scripted screens.
  const scriptedDisciplineBlock =
    args.screen_id === 'MCHECK-01' || args.screen_id === 'ECHECK-01'
      ? `\n\n${buildScriptedDiscipline()}`
      : '';
  // Habit polarity must be known BEFORE the first tool call so a cold
  // single-turn slip ("I caved on no-news") isn't recorded as a win.
  const checkinHabitsBlock = isCheckin ? await buildCheckinHabitsBlock(args.anon_id) : '';
  // The evening reflection uses THIS USER'S configured questions (not hardcoded),
  // so ECHECK-01 needs the settings block; HOME-CHECKIN keeps it for free-form
  // journaling + update_reflection edits. Morning has no reflection, so MCHECK
  // does not get it.
  const reflectionSettingsBlock =
    args.screen_id === 'HOME-CHECKIN' || args.screen_id === 'ECHECK-01'
      ? await buildReflectionSettingsBlock(args.anon_id)
      : '';
  const openerNudge = args.mode === 'opener' ? `\n\n${OPENER_INSTRUCTIONS}` : '';
  // Scripted opener lines (greeting + state/habit prompt), rotating per day.
  const eveningOpenerBlock =
    args.mode === 'opener' && args.screen_id === 'ECHECK-01'
      ? `\n\n${buildEveningOpener(daySeed)}`
      : '';
  const morningOpenerBlock =
    args.mode === 'opener' && args.screen_id === 'MCHECK-01'
      ? `\n\n${buildMorningOpener(daySeed)}`
      : '';
  const inputModeBlock = args.input_mode === 'voice' ? '' : `\n\n${TEXT_INPUT_RULE}`;
  const onboardingRow = isOnboardingScreen ? await fetchOnboardingRow(args.anon_id) : null;
  const alreadyFilledBlock = onboardingRow ? buildAlreadyFilledBlock(onboardingRow) : '';
  const optionsBlock = isOnboardingScreen
    ? buildCanonicalOptionsBlock(args.screen_id, onboardingRow?.data ?? {})
    : '';

  return {
    systemPrompt: `${coachingPreamble}${productBlock}\n\n${NO_PRENARRATION_RULE}\n\n${NO_INTERNAL_NARRATION_RULE}\n\n${CONVERSATIONAL_SURFACE_RULE}${onboardingNudge}${checkinNudge}${readonlyNudge}${timeBlock}${walkthroughBlock}${morningFlowBlock}${scriptedDisciplineBlock}${checkinHabitsBlock}${reflectionSettingsBlock}${alreadyFilledBlock}${optionsBlock}${openerNudge}${eveningOpenerBlock}${morningOpenerBlock}${inputModeBlock}\n\n${contextMessage}`,
    contextVersion: screen.version,
    deltaCount: state_delta.length,
  };
}

interface OnboardingRow {
  data: Record<string, unknown> | null;
  current_step: number;
  path: string | null;
}

async function fetchOnboardingRow(anonId: string): Promise<OnboardingRow | null> {
  const res = await pool.query<OnboardingRow>(
    `SELECT data, current_step, path FROM onboarding_states WHERE anon_id = $1`,
    [anonId],
  );
  return res.rows[0] ?? null;
}

// Active habits + polarity, so the coach knows do-vs-avoid before any tool
// call. An avoid habit succeeds when ABSTAINED — a slip is an unmarked day,
// never a complete_habit win.
async function buildCheckinHabitsBlock(anonId: string): Promise<string> {
  const res = await pool.query<{ name: string; habit_type: string }>(
    `SELECT name, habit_type FROM user_habits
      WHERE anon_id = $1 AND is_active = true AND archived_at IS NULL
      ORDER BY sort_order ASC`,
    [anonId],
  );
  if (res.rowCount === 0) return '';
  const lines = res.rows
    .map((r) => `- ${r.name} — ${r.habit_type === 'binary_avoid' ? 'avoid' : 'do'}`)
    .join('\n');
  return (
    `\n\n## Active Habits (polarity)\n` +
    `${lines}\n` +
    `A "do" habit succeeds when the user DID it; an "avoid" habit succeeds when they ABSTAINED. ` +
    `Before calling complete_habit for an avoid habit, confirm the user actually abstained. ` +
    `If they slipped ("I caved", "I watched the news"), do NOT complete it — that day is simply left unmarked.`
  );
}

// The user's current reflection mode + prompts, so the coach (a) walks the right
// questions during the evening reflection and (b) can edit them via update_reflection
// (add/remove needs the current list in context).
async function buildReflectionSettingsBlock(anonId: string): Promise<string> {
  const settings = await readReflectionSettings(anonId);
  const editLine =
    `To change/add/remove a reflection question or switch mode, call update_reflection with the ` +
    `COMPLETE new prompts list (to add: the list above plus the new one; to remove: the list above ` +
    `minus that one) — never send only the delta. This edits their setup; it does NOT log an entry.`;
  if (settings.mode === 'freeform') {
    return (
      `\n\n## Reflection Settings (this user)\n` +
      `Mode: FREEFORM (no set questions). During the evening reflection, do NOT walk a fixed list — ` +
      `ask ONE open prompt (e.g. "What stood out about today?") and call log_reflection(text='<their words>'). ` +
      `Ignore any default question list in the screen guidance.\n${editLine}`
    );
  }
  const prompts = settings.prompts.length > 0 ? settings.prompts : DEFAULT_REFLECTION_PROMPTS;
  const numbered = prompts.map((p, i) => `${i + 1}. ${p}`).join('\n');
  return (
    `\n\n## Reflection Settings (this user)\n` +
    `Mode: GUIDED. The user's current reflection questions are:\n${numbered}\n` +
    `During the evening reflection, walk EXACTLY these in order, one per turn, and call ` +
    `log_reflection(text='<the user's words>', title='<the prompt>') for each. Ignore any default ` +
    `list in the screen guidance.\n${editLine}`
  );
}

// Invalid/missing tz → no line, never throw; greeting just stays time-agnostic.
function buildCurrentTimeBlock(timezone?: string): string {
  if (!timezone) return '';
  let bucket: string;
  let hour: number;
  try {
    const now = new Date();
    hour = localHour(now, timezone);
    bucket = bucketTimeOfDay(now, timezone);
  } catch {
    return '';
  }
  const clock = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? 'am' : 'pm';
  return (
    `\n\n## Current Time\n` +
    `Current local time: ${bucket} (around ${clock}${ampm}). Greet and frame the check-in accordingly — do not assume morning if it is afternoon, evening, or night.`
  );
}

function buildAlreadyFilledBlock(row: OnboardingRow): string {
  const data = row.data ?? {};
  const hasData = Object.keys(data).length > 0;
  if (!hasData && !row.path) return '';
  return (
    `\n\n## Already-Filled Fields\n` +
    `current_step: ${row.current_step}\n` +
    (row.path ? `path: ${row.path}\n` : '') +
    `data: ${JSON.stringify(data)}\n` +
    `Do NOT re-ask for any field that already has a value here. Acknowledge briefly if the user re-states it, then move to the next still-missing field per the screen's BEHAVIOR.`
  );
}

const TEXT_INPUT_RULE = `## Text Mode
The user is TYPING, not speaking. Don't tell them to tap, touch the orb, or say things aloud — phrase guidance for a keyboard/text user.`;

const FALLBACK_CONTEXT_BLOCK = `## Screen
No screen-specific guidance is configured for this screen. Respond helpfully and briefly in your coaching voice, using the recent activity below for continuity. Do not invent screen-specific instructions or pre-announce features.`;

const OPENER_INSTRUCTIONS = `## Opener Turn

The user just opened the chat overlay on this screen and has NOT typed anything yet. The "user message" you see is a placeholder.

Speak first. Open with the line this screen's BEHAVIOR calls for (often a complete question covering all the fields it wants to capture). Use the recent events (state delta) to make it feel current when relevant.

Rules:
- No generic greetings like "How can I help?", "What's up?", or "What can I do for you?".
- Do NOT mention that the chat was just opened. Just open the conversation naturally.
- Do NOT call any MUTATING tools on this turn — no \`update_profile\`, \`navigate_next\`, \`complete_habit\`, \`record_checkin\`, etc. Those resume on the next user-initiated turn. A read-only tool (\`query_habits\` / \`query_checkin\`) MAY be called if available this turn to ground your opener.`;
