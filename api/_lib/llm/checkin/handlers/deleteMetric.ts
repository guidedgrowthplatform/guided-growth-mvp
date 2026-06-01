import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { ok, resolveMetricArg, type CheckinHandlerCtx } from './shared.js';

export async function deleteMetric(
  ctx: CheckinHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const found = await resolveMetricArg(ctx.anon_id, args);
  if (!found.ok) return found.error;
  const metric = found.value;

  await pool.query(`DELETE FROM metrics WHERE id = $1 AND anon_id = $2`, [metric.id, ctx.anon_id]);

  return ok({ deleted: true, metric: { id: metric.id, name: metric.name } });
}
