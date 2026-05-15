import type { SessionStateDeltaEntry } from '../types/context.js';

export interface BuildContextMessageInput {
  screen_id: string;
  context_block: string;
  state_delta: readonly SessionStateDeltaEntry[];
}

function renderEvent(e: SessionStateDeltaEntry): string {
  const head = `- ${e.event_type} at ${e.timestamp}`;
  if (!e.payload || Object.keys(e.payload).length === 0) return head;
  return `${head} — ${JSON.stringify(e.payload)}`;
}

export function buildContextMessage(input: BuildContextMessageInput): string {
  const events =
    input.state_delta.length === 0 ? '(none)' : input.state_delta.map(renderEvent).join('\n');

  return [
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
