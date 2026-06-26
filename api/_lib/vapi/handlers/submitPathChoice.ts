/**
 * submit_path_choice handler — writes the user's path selection
 * (simple vs braindump) to onboarding_states.
 *
 * Auth model: see submitProfile.ts. Channel auth is X-Vapi-Secret;
 * identity arrives as `anon_id` injected by Vapi from static call params.
 *
 * Drift note: PATH_OPTIONS is the single source of truth for allowed values;
 * mirrors the manual path-choice UI option set.
 */
import pool, { type Queryable } from '../../db.js';
import { PATH_OPTIONS } from '../../llm/tools.onboarding.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

function isPathOption(v: string): boolean {
  return (PATH_OPTIONS as readonly string[]).includes(v);
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

  const path = getString(args, 'path');
  if (path === undefined || path.length === 0) {
    console.log('[vapi/tool] validation_failed reason=path_required');
    return { error: 'validation_failed: path is required' };
  }
  if (!isPathOption(path)) {
    console.log('[vapi/tool] validation_failed reason=path_not_in_enum');
    return { error: `validation_failed: path must be one of ${PATH_OPTIONS.join(', ')}` };
  }

  // DATA ONLY — writes the `path` column. current_step is not touched on
  // UPDATE; navigate_next handles the screen advance. INSERT path defaults
  // to step 2 (where submit_path_choice fires from).
  const result = await db.query(
    `INSERT INTO onboarding_states (anon_id, current_step, path, status, data, updated_at)
     VALUES ($1, 2, $2, 'in_progress', '{}'::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       path = $2,
       status = 'in_progress',
       updated_at = now()`,
    [anonId, path],
  );

  console.log(`[vapi/tool] submit_path_choice written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
