/**
 * submit_path_choice handler — writes the user's path selection to
 * onboarding_states. Accepts canonical 'beginner'|'advanced' (render canon) or
 * legacy 'simple'|'braindump'; dual-writes canonical data.path + legacy column.
 *
 * Auth model: see submitProfile.ts. Channel auth is X-Vapi-Secret;
 * identity arrives as `anon_id` injected by Vapi from static call params.
 */
import pool, { type Queryable } from '../../db.js';
import { normalizePath } from '../../llm/tools.onboarding.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

export async function submitPathChoice(
  args: Record<string, unknown>,
  db: Queryable = pool,
): Promise<HandlerResult> {
  console.log('[vapi/tool] received name=submit_path_choice anon_id=' + getString(args, 'anon_id'));

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  const raw = getString(args, 'path');
  if (raw === undefined || raw.length === 0) {
    console.log('[vapi/tool] validation_failed reason=path_required');
    return { error: 'validation_failed: path is required' };
  }
  const normalized = normalizePath(raw);
  if (!normalized) {
    console.log('[vapi/tool] validation_failed reason=path_not_in_enum');
    return { error: 'validation_failed: path must be one of beginner, advanced' };
  }
  const { canonical, legacy } = normalized;

  // DATA ONLY — dual-write: legacy column + canonical data.path. current_step
  // is not touched on UPDATE; navigate_next handles the screen advance. INSERT
  // path defaults to step 2 (where submit_path_choice fires from).
  const result = await db.query(
    `INSERT INTO onboarding_states (anon_id, current_step, path, status, data, updated_at)
     VALUES ($1, 2, $2, 'in_progress', jsonb_build_object('path', $3::text), now())
     ON CONFLICT (anon_id) DO UPDATE SET
       path = $2,
       data = onboarding_states.data || jsonb_build_object('path', $3::text),
       status = 'in_progress',
       updated_at = now()`,
    [anonId, legacy, canonical],
  );

  console.log(`[vapi/tool] submit_path_choice written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
