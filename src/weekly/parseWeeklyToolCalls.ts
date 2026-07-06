/**
 * Extract weekly_* tool names from a Vapi client `message` event.
 *
 * Vapi delivers a tool call in two shapes depending on assistant config:
 *   1. { type: 'function-call', functionCall: { name, ... } }        (singular)
 *   2. { type: 'tool-calls', toolCallList: [{ function: { name } }] } (batched)
 * Some builds put the name directly on the list item (`.name`) instead of
 * nested under `.function`. This parser tolerates all of those, ignores every
 * non-weekly / non-tool message, and returns a plain list of matched names.
 *
 * NO EM DASHES.
 */

export const WEEKLY_TOOL_NAMES = [
  'weekly_advance',
  'weekly_complete',
  'weekly_update_habit',
  'weekly_archive_habit',
  'weekly_add_habit',
] as const;

export type WeeklyToolName = (typeof WEEKLY_TOOL_NAMES)[number];

const WEEKLY_TOOL_SET = new Set<string>(WEEKLY_TOOL_NAMES);

function nameOf(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as { name?: unknown; function?: { name?: unknown } | null };
  if (typeof item.name === 'string') return item.name;
  if (item.function && typeof item.function === 'object') {
    const fnName = (item.function as { name?: unknown }).name;
    if (typeof fnName === 'string') return fnName;
  }
  return undefined;
}

export function parseWeeklyToolCalls(message: unknown): string[] {
  if (!message || typeof message !== 'object') return [];
  const m = message as {
    functionCall?: unknown;
    toolCallList?: unknown;
    toolCalls?: unknown;
  };

  const found: string[] = [];
  const consider = (raw: string | undefined) => {
    if (raw && WEEKLY_TOOL_SET.has(raw)) found.push(raw);
  };

  // Shape 1: singular function-call.
  consider(nameOf(m.functionCall));

  // Shape 2: batched tool-calls (list may live under either key).
  const list = Array.isArray(m.toolCallList)
    ? m.toolCallList
    : Array.isArray(m.toolCalls)
      ? m.toolCalls
      : [];
  for (const item of list) consider(nameOf(item));

  return found;
}
