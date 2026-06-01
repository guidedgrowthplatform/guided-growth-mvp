import type { ToolResult } from '../tools.js';
import { createHabit } from './handlers/createHabit.js';
import { completeHabit } from './handlers/completeHabit.js';
import { updateHabit } from './handlers/updateHabit.js';
import { deleteHabit } from './handlers/deleteHabit.js';
import { createMetric } from './handlers/createMetric.js';
import { logMetric } from './handlers/logMetric.js';
import { deleteMetric } from './handlers/deleteMetric.js';
import { recordCheckin } from './handlers/recordCheckin.js';
import { startFocus } from './handlers/startFocus.js';
import { queryHabits } from './handlers/queryHabits.js';
import { getSummary } from './handlers/getSummary.js';
import { suggestHabit } from './handlers/suggestHabit.js';
import type { CheckinHandlerCtx } from './handlers/shared.js';
import { isCheckinToolName, type CheckinToolName } from './schemas.js';

type Handler = (ctx: CheckinHandlerCtx, args: Record<string, unknown>) => Promise<ToolResult>;

const HANDLERS: Record<CheckinToolName, Handler> = {
  create_habit: createHabit,
  complete_habit: completeHabit,
  update_habit: updateHabit,
  delete_habit: deleteHabit,
  create_metric: createMetric,
  log_metric: logMetric,
  delete_metric: deleteMetric,
  record_checkin: recordCheckin,
  start_focus: startFocus,
  query_habits: queryHabits,
  get_summary: getSummary,
  suggest_habit: suggestHabit,
};

export async function dispatchCheckinToolCall(
  name: string,
  args: unknown,
  ctx: {
    anon_id: string | null | undefined;
    tool_call_id?: string;
    dedupLookup?: (toolCallId: string) => Promise<ToolResult | null>;
    timezone?: string;
  },
): Promise<ToolResult> {
  if (!ctx.anon_id) {
    return { ok: false, error: 'invalid_args', message: 'missing anon_id' };
  }
  if (!isCheckinToolName(name)) {
    return { ok: false, error: 'unknown_tool', message: `Unknown tool: ${name}` };
  }
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return { ok: false, error: 'invalid_args', message: 'args must be an object' };
  }
  const handler = HANDLERS[name];
  return handler(
    {
      anon_id: ctx.anon_id,
      tool_call_id: ctx.tool_call_id,
      dedupLookup: ctx.dedupLookup,
      timezone: ctx.timezone,
    },
    args as Record<string, unknown>,
  );
}
