import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { INPUT_TYPE_OPTIONS } from '../schemas.js';
import {
  checkDedup,
  findMetricByName,
  getNumber,
  getString,
  invalid,
  ok,
  type CheckinHandlerCtx,
} from './shared.js';

// No `frequency` column — not in migrations (legacy drift).
interface InsertedMetric {
  id: string;
  name: string;
  input_type: string;
  scale_min: number | null;
  scale_max: number | null;
}

export async function createMetric(
  ctx: CheckinHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const cached = await checkDedup(ctx);
  if (cached) return cached;

  const name = getString(args, 'name')?.trim();
  if (!name) return invalid('name is required');

  const inputType = getString(args, 'input_type') ?? 'scale';
  if (!(INPUT_TYPE_OPTIONS as readonly string[]).includes(inputType)) {
    return invalid(`input_type must be one of ${INPUT_TYPE_OPTIONS.join(', ')}`);
  }

  const scaleMin = getNumber(args, 'scale_min');
  const scaleMax = getNumber(args, 'scale_max');

  const existing = await findMetricByName(ctx.anon_id, name);
  if (existing) return invalid(`You already track a metric called "${existing.name}".`);

  const res = await pool.query<InsertedMetric>(
    `INSERT INTO metrics (anon_id, name, input_type, scale_min, scale_max)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, input_type, scale_min, scale_max`,
    [ctx.anon_id, name, inputType, scaleMin ?? null, scaleMax ?? null],
  );
  const row = res.rows[0];

  return ok({
    created: true,
    metric: {
      id: row.id,
      name: row.name,
      input_type: row.input_type,
      scale_min: row.scale_min,
      scale_max: row.scale_max,
    },
  });
}
