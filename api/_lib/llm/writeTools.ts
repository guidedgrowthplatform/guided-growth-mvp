// Mutating tools whose handler_error must surface to the client as tool_failed.
// Mirror of MUTATION_TOOLS in src/hooks/useCoachChatToolEvents.ts — read-only
// query_* / get_summary / suggest_habit are excluded.
export const WRITE_TOOLS: ReadonlySet<string> = new Set([
  'create_habit',
  'complete_habit',
  'update_habit',
  'delete_habit',
  'create_metric',
  'log_metric',
  'delete_metric',
  'record_checkin',
  'start_focus',
  'log_reflection',
]);
