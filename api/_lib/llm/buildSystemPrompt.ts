import pool from '../db.js';
import { buildSystemPrompt } from '@shared/coaching/systemPrompt.js';
import type { CoachingStyle } from '@shared/coaching/styles.js';
import { buildContextMessage } from '@shared/context/buildContextMessage.js';
import type { SessionStateDeltaEntry } from '@shared/types/context.js';

export interface BuildSystemPromptArgs {
  anon_id: string;
  screen_id: string;
  coaching_style: CoachingStyle;
}

export interface BuildSystemPromptResult {
  systemPrompt: string;
  contextVersion: number;
  deltaCount: number;
}

export class BuildSystemPromptError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
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
  if (screenRes.rowCount === 0) {
    throw new BuildSystemPromptError(
      'unknown_screen_id',
      404,
      `Unknown screen_id: ${args.screen_id}`,
    );
  }
  const screen = screenRes.rows[0];

  // Skip llm_call rows — they crowd out real user events from state_delta.
  const logRes = await pool.query<SessionLogRow>(
    `SELECT id, session_id, timestamp, event_type, screen_id, payload
       FROM session_log
      WHERE anon_id = $1 AND event_type <> 'llm_call'
      ORDER BY timestamp DESC
      LIMIT 15`,
    [args.anon_id],
  );

  const state_delta: SessionStateDeltaEntry[] = logRes.rows
    .map((r) => ({
      id: r.id,
      session_id: r.session_id,
      timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
      event_type: r.event_type,
      screen_id: r.screen_id,
      payload: r.payload,
    }))
    .reverse();

  // Anonymization policy: only coaching_style flows into the preamble.
  // Do NOT hydrate UserContext.name / email / last_name from profiles —
  // the LLM gets first_name only via the AI Context Block on screens
  // where it's already part of the prompt.
  const coachingPreamble = buildSystemPrompt({ coachingStyle: args.coaching_style });
  const contextMessage = buildContextMessage({
    screen_id: args.screen_id,
    context_block: screen.context_block,
    state_delta,
  });

  const isOnboardingScreen = args.screen_id.startsWith('ONBOARD-');
  const onboardingNudge = isOnboardingScreen ? `\n\n${ONBOARDING_TOOL_INSTRUCTIONS}` : '';

  return {
    systemPrompt: `${coachingPreamble}${onboardingNudge}\n\n${contextMessage}`,
    contextVersion: screen.version,
    deltaCount: state_delta.length,
  };
}

const ONBOARDING_TOOL_INSTRUCTIONS = `## Onboarding Screen Rules

When CURRENT SCREEN starts with \`ONBOARD-\`, the screen's BEHAVIOR block is your script. Drive the user through the step — do not just respond conversationally.

OPENING TURN. If this is the first message on this screen (no prior assistant turn for the user-message you're responding to) AND the user's input is a greeting ("Hey", "Hi", "Hello") or otherwise doesn't answer the screen's questions: do NOT greet back generically. Open the screen's script directly — ask the first question from the BEHAVIOR block (or the AI Voice copy if quoted there). For ONBOARD-01 that's: "OK — let me get to know you. What's your name, how old are you, how do you identify, and how did you hear about us?" Never say "What can I help you with?" — this is a guided flow, not a generic chat.

Use tools aggressively. The "What this screen is for" block tells you which fields to capture and where to go next.

Capture profile fields with \`update_profile\`:
- Recognize names from: "Call me X", "You can call me X", "I'm X", "My name is X", "Name's X", or a single capitalized word reply on a name-asking screen. Save as field=\`name\` (or \`nickname\` if user prefers a short handle).
- Recognize age expressions ("twenty-five", "25", "I'm 30") → field=\`age_group\` (store the string value, server validates).
- Recognize gender: "guy/man/boy" → "Male"; "girl/woman/lady" → "Female"; "non-binary/they" → "Other". Save as field=\`gender\`.
- Recognize referral: "TikTok/Instagram/IG" → "Social media"; "friend" → "Friend"; "Google/search" → "Website". Save as field=\`referral_source\`.
- Call \`update_profile\` once per field you extract, in the SAME turn as your text response. Tools first, then text.

Never re-ask a field you just captured. If the user gave a name, acknowledge it ("Hey Mint.") and ask only for the next missing field per the screen's BEHAVIOR.

Advance with \`navigate_next\`:
- When the screen's NEXT condition in BEHAVIOR is satisfied (e.g. all required fields collected, or a single choice made), call \`navigate_next({target_screen: "..."})\` with the screen ID from the BEHAVIOR block's NEXT line.
- Do this in the same turn — after your acknowledgement text and any \`update_profile\` calls.

If the user is vague or off-topic, follow the EDGE CASES guidance in the BEHAVIOR block instead of falling back to a generic greeting.`;
