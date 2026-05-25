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

export function buildContextMessage(input: BuildContextMessageInput): string {
  const events =
    input.state_delta.length === 0 ? '(none)' : input.state_delta.map(renderEvent).join('\n');

  const filledRendered = input.filled_form_state
    ? renderFilledFormState(input.filled_form_state)
    : '';

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

  return [
    ...filledHeader,
    '*** ACTIVE SCREEN UPDATE ***',
    'This message supersedes any earlier screen-context messages in this conversation. Treat only the screen described below as the current screen, and ignore prior screen anchors when deciding what to say or do next.',
    '',
    `CURRENT SCREEN: ${input.screen_id}`,
    '',
    'What this screen is for:',
    input.context_block,
    '',
    'Recent events on this screen (most recent last):',
    events,
  ].join('\n');
}
