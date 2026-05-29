/**
 * submit_category handler — writes the user's chosen category
 * (e.g. "Sleep better", "Move more") to onboarding_states.data.category.
 *
 * Auth model: see submitProfile.ts. Channel auth is X-Vapi-Secret;
 * identity arrives as `anon_id` injected by Vapi from static call params.
 *
 * Drift note: CATEGORY_OPTIONS is the single source of truth; mirrors the
 * manual category-picker UI.
 */
import pool from '../../db.js';
import { CATEGORY_OPTIONS } from '../../llm/tools.onboarding.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

function isCategoryOption(v: string): boolean {
  return (CATEGORY_OPTIONS as readonly string[]).includes(v);
}

export async function submitCategory(args: Record<string, unknown>): Promise<HandlerResult> {
  console.log('[vapi/tool] received name=submit_category anon_id=' + getString(args, 'anon_id'));

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  const category = getString(args, 'category');
  if (category === undefined || category.length === 0) {
    console.log('[vapi/tool] validation_failed reason=category_required');
    return { error: 'validation_failed: category is required' };
  }
  if (!isCategoryOption(category)) {
    console.log('[vapi/tool] validation_failed reason=category_not_in_enum');
    return { error: `validation_failed: category must be one of ${CATEGORY_OPTIONS.join(', ')}` };
  }

  const payload = JSON.stringify({ category });

  // DATA ONLY — current_step not touched on UPDATE; navigate_next handles
  // the screen advance. INSERT path defaults to step 3 (beginner category).
  const result = await pool.query(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 3, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()`,
    [anonId, payload],
  );

  console.log(`[vapi/tool] submit_category written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
