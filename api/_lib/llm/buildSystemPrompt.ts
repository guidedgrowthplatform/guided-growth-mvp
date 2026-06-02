import pool from '../db.js';
import { buildSystemPrompt } from '@gg/shared/coaching/systemPrompt';
import type { CoachingStyle } from '@gg/shared/coaching/styles';
import { buildContextMessage } from '@gg/shared/context/buildContextMessage';
import type { SessionStateDeltaEntry } from '@gg/shared/types/context';
import { ONBOARDING_TOOL_ADDENDUM } from './onboarding/systemPromptAddendum.js';
import { stripResponsePattern } from './onboarding/stripResponsePattern.js';
import { CHECKIN_TOOL_ADDENDUM } from './checkin/systemPromptAddendum.js';
import { isCheckinScreen } from './checkin/registry.js';

export interface BuildSystemPromptArgs {
  anon_id: string;
  screen_id: string;
  coaching_style: CoachingStyle;
  // Optimistic state_delta from the client. When provided, used instead of
  // querying session_log — avoids the race where a logEvent POST hasn't
  // landed before the LLM call.
  recent_events?: SessionStateDeltaEntry[];
  mode?: 'chat' | 'opener';
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
  const contextBlock = isOnboardingScreen
    ? stripResponsePattern(screen.context_block)
    : screen.context_block;
  const contextMessage = buildContextMessage({
    screen_id: args.screen_id,
    context_block: contextBlock,
    state_delta,
  });

  const onboardingNudge = isOnboardingScreen ? `\n\n${ONBOARDING_TOOL_ADDENDUM}` : '';
  const checkinNudge = isCheckinScreen(args.screen_id) ? `\n\n${CHECKIN_TOOL_ADDENDUM}` : '';
  const openerNudge = args.mode === 'opener' ? `\n\n${OPENER_INSTRUCTIONS}` : '';
  const alreadyFilledBlock = isOnboardingScreen ? await buildAlreadyFilledBlock(args.anon_id) : '';

  return {
    systemPrompt: `${coachingPreamble}${onboardingNudge}${checkinNudge}${alreadyFilledBlock}${openerNudge}\n\n${contextMessage}`,
    contextVersion: screen.version,
    deltaCount: state_delta.length,
  };
}

async function buildAlreadyFilledBlock(anonId: string): Promise<string> {
  const res = await pool.query<{
    data: Record<string, unknown> | null;
    current_step: number;
    path: string | null;
  }>(`SELECT data, current_step, path FROM onboarding_states WHERE anon_id = $1`, [anonId]);
  const row = res.rows[0];
  if (!row) return '';
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

const FALLBACK_CONTEXT_BLOCK = `## Screen
No screen-specific guidance is configured for this screen. Respond helpfully and briefly in your coaching voice, using the recent activity below for continuity. Do not invent screen-specific instructions or pre-announce features.`;

const OPENER_INSTRUCTIONS = `## Opener Turn

The user just opened the chat overlay on this screen and has NOT typed anything yet. The "user message" you see is a placeholder.

Speak first. Follow the screen's BEHAVIOR / AI RESPONSE PATTERN exactly — use the full opening line the screen specifies (often a complete question covering all the fields it wants to capture). If the screen quotes an AI Voice copy line for the opening turn, use that verbatim or close to it. Use the recent events (state delta) to make it feel current when relevant.

Rules:
- No generic greetings like "How can I help?", "What's up?", or "What can I do for you?".
- Do NOT mention that the chat was just opened. Just open the conversation naturally.
- Do NOT call any tools on this turn — no \`update_profile\`, no \`navigate_next\`. Pure text only. Tools resume on the next user-initiated turn.`;
