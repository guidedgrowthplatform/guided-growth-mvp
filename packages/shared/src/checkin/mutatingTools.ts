// Mutating tools (read-only query_*/get_summary/suggest_habit excluded).
export const MUTATING_TOOLS: ReadonlySet<string> = new Set([
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
  'update_reflection',
]);
