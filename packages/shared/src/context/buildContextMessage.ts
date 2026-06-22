import { goalsByCategory } from '../data/onboardingGoals.js';
import { habitsByGoal } from '../data/onboardingHabits.js';
import type { SessionStateDeltaEntry } from '../types/context.js';

export interface BuildContextMessageInput {
  screen_id: string;
  context_block: string;
  state_delta: readonly SessionStateDeltaEntry[];
  // Optional snapshot of fields already filled on the current screen + prior
  // pages (read from onboarding_states.data merged with the page's in-flight
  // React state). Empty/undefined values are skipped by the renderer.
  filled_form_state?: Record<string, unknown>;
}

function renderEvent(e: SessionStateDeltaEntry): string {
  const head = `- ${e.event_type} at ${e.timestamp}`;
  if (!e.payload || Object.keys(e.payload).length === 0) return head;
  return `${head} — ${JSON.stringify(e.payload)}`;
}

function renderFilledFormState(filled: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(filled)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) {
      continue;
    }
    const rendered =
      typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
        ? String(v)
        : JSON.stringify(v);
    lines.push(`- ${k}: ${rendered}`);
  }
  return lines.join('\n');
}

// On screens where the visible cards depend on prior choices (goals filtered
// by category, habits filtered by goals), inject the pre-filtered list so the
// LLM knows EXACTLY what the user sees on screen — no mental lookup against
// the long "all options across all categories" tables in the screen context,
// no asking "what habits do you have in mind?" when the screen shows 6 cards.
// Returns empty string when the source data is missing.
function renderScreenOptions(
  screen_id: string,
  filled: Record<string, unknown> | undefined,
): string {
  if (!filled) return '';

  if (screen_id === 'ONBOARD-BEGINNER-02') {
    const category = filled.category;
    if (typeof category !== 'string' || category.length === 0) return '';
    const options = goalsByCategory[category];
    if (!options || options.length === 0) return '';
    return [
      `ON-SCREEN OPTIONS (filtered for the user's category "${category}" — these are the exact cards visible on the screen):`,
      ...options.map((o) => `- ${o}`),
      '',
      `ARRIVAL PATTERN: on arrival, list these in ONE short sentence and ask the user to pick — e.g. "Within ${category.toLowerCase()} — ${options.join(', ').replace(/, ([^,]*)$/, ', or $1')}?". Then STOP and wait. Do NOT say the word "options" or "cards". NO per-option commentary. NO speeches. After the user picks, call submit_goals(goals=[exact labels]) + navigate_next in the same turn.`,
    ].join('\n');
  }

  if (screen_id === 'ONBOARD-BEGINNER-03') {
    const goals = filled.goals;
    if (!Array.isArray(goals) || goals.length === 0) return '';
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const goal of goals) {
      if (typeof goal !== 'string') continue;
      const habits = habitsByGoal[goal];
      if (!habits) continue;
      for (const h of habits) {
        if (seen.has(h)) continue;
        seen.add(h);
        ordered.push(h);
      }
    }
    if (ordered.length === 0) return '';
    const goalsLabel = goals
      .filter((g): g is string => typeof g === 'string')
      .map((g) => `"${g}"`)
      .join(', ');
    return [
      `ON-SCREEN OPTIONS (filtered for the user's goals [${goalsLabel}] — these are the exact habit cards visible on the screen; capture each pick with add_habit(name=EXACT canonical label below)):`,
      ...ordered.map((h) => `- ${h}`),
      '',
      `ARRIVAL PATTERN: on arrival, ask which feel doable in ONE short sentence listing the habits. Apply the global TTS rule when speaking — digits and symbols become English words (see TTS-SAFE SPEECH rule). Do NOT say the words "cards" or "options". After the user picks, call add_habit(name=<EXACT canonical label from the list above, with digits>) and continue. NO per-habit commentary. NO speeches. Once user signals done, navigate_next(target_step=6).`,
    ].join('\n');
  }

  return '';
}

export function buildContextMessage(input: BuildContextMessageInput): string {
  const events =
    input.state_delta.length === 0 ? '(none)' : input.state_delta.map(renderEvent).join('\n');

  const filledRendered = input.filled_form_state
    ? renderFilledFormState(input.filled_form_state)
    : '';

  const screenOptions = renderScreenOptions(input.screen_id, input.filled_form_state);

  // FORM STATE goes at the TOP — before the screen context — so the LLM
  // reads "these are KNOWN values, override default behavior" BEFORE it
  // reads "this is the name-collection screen, ask for name". Anchoring
  // at the bottom is too weak; the long screen description out-anchors it.
  const filledHeader = filledRendered
    ? [
        '*** USER KNOWN STATE — READ FIRST, OVERRIDES SCREEN DEFAULTS ***',
        'The following values are ALREADY KNOWN about this user (persisted from earlier in onboarding OR typed into the current form). They are FACTS, not user input you still need to collect.',
        '',
        filledRendered,
        '',
        'RULES:',
        '- DO NOT ask the user for any field listed above. They are already provided.',
        '- DO greet by the nickname when it is set (e.g. "Hi Jonas").',
        '- If the screen would normally collect one of these fields, SKIP that question and move to the next unfilled field instead.',
        '- Only ask about fields that are NOT in the list above.',
        '',
        '---',
        '',
      ]
    : [];

  // Empty when no filter applies; preserves the canonical "blank line after
  // CURRENT SCREEN" spacing so screens that don't need filtered options
  // produce byte-identical output to before this change.
  const screenOptionsBlock = screenOptions ? [screenOptions, ''] : [];

  return [
    ...filledHeader,
    '*** ACTIVE SCREEN UPDATE ***',
    'This message supersedes any earlier screen-context messages in this conversation. Treat only the screen described below as the current screen, and ignore prior screen anchors when deciding what to say or do next.',
    '',
    `CURRENT SCREEN: ${input.screen_id}`,
    '',
    ...screenOptionsBlock,
    'What this screen is for:',
    input.context_block,
    '',
    'Recent events on this screen (most recent last):',
    events,
  ].join('\n');
}
