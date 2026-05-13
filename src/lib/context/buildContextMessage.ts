/**
 * P1-09 — Canonical context system-message body shared across LLM channels.
 *
 * Every channel that talks to the LLM (Path 1 Vapi via `add-message`, Path 2
 * Async Reflection, Path 3 Direct LLM) renders its "screen + recent events"
 * briefing through this function. The output is the literal string the LLM
 * sees as a system message, so any drift here causes coaching to diverge
 * across channels — which is what the P1-43 HARD GATE protects against.
 *
 * Don't reformat casually. The snapshot test in buildContextMessage.test.ts
 * is the contract; if it changes, all consumers update in the same PR.
 */
import type { SessionStateDeltaEntry } from '@/api/context';

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
    `User just opened screen: ${input.screen_id}`,
    '',
    'Context for this screen:',
    input.context_block,
    '',
    'Recent session events:',
    events,
  ].join('\n');
}
