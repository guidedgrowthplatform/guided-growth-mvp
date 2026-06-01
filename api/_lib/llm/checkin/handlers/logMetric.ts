import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import {
  getNumber,
  getString,
  invalid,
  ok,
  parseDateParam,
  resolveMetricArg,
  todayStr,
  type CheckinHandlerCtx,
} from './shared.js';

export async function logMetric(
  ctx: CheckinHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  // value may arrive as string or number; stored as TEXT either way.
  const valueStr = getString(args, 'value') ?? getNumber(args, 'value')?.toString();
  if (valueStr === undefined || valueStr.trim() === '') return invalid('value is required');

  const found = await resolveMetricArg(ctx.anon_id, args);
  if (!found.ok) return found.error;
  const metric = found.value;

  const date = parseDateParam(getString(args, 'date'));
  if (date > todayStr()) return invalid(`Cannot log "${metric.name}" for a future date (${date}).`);

  await pool.query(
    `INSERT INTO metric_entries (anon_id, metric_id, value, date)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (metric_id, date) DO UPDATE SET value = EXCLUDED.value`,
    [ctx.anon_id, metric.id, valueStr, date],
  );

  return ok({ logged: true, metric: { id: metric.id, name: metric.name }, value: valueStr, date });
}
