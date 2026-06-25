/**
 * submit_brain_dump handler — writes the user's free-form brain dump text
 * to onboarding_states. Stored in BOTH:
 *   - data.brainDumpText (camelCase for app consumption)
 *   - brain_dump_raw column (top-level, mirrors api/onboarding/[...path].ts)
 *
 * Auth model: see submitProfile.ts. Channel auth is X-Vapi-Secret;
 * identity arrives as `anon_id` injected by Vapi from static call params.
 *
 * Length: 10-5000 chars.
 */
import pool, { type Queryable } from '../../db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRAIN_DUMP_MIN_LEN = 10;
const BRAIN_DUMP_MAX_LEN = 5000;

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

export async function submitBrainDump(
  args: Record<string, unknown>,
  db: Queryable = pool,
): Promise<HandlerResult> {
  console.log('[vapi/tool] received name=submit_brain_dump anon_id=' + getString(args, 'anon_id'));

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  const brainDumpRaw = getString(args, 'brain_dump_raw');
  if (brainDumpRaw === undefined) {
    console.log('[vapi/tool] validation_failed reason=brain_dump_required');
    return { error: 'validation_failed: brain_dump_raw is required' };
  }
  if (brainDumpRaw.length < BRAIN_DUMP_MIN_LEN) {
    console.log('[vapi/tool] validation_failed reason=brain_dump_too_short');
    return {
      error: `validation_failed: brain_dump_raw must be at least ${BRAIN_DUMP_MIN_LEN} characters`,
    };
  }
  if (brainDumpRaw.length > BRAIN_DUMP_MAX_LEN) {
    console.log('[vapi/tool] validation_failed reason=brain_dump_too_long');
    return {
      error: `validation_failed: brain_dump_raw must be at most ${BRAIN_DUMP_MAX_LEN} characters`,
    };
  }

  const payload = JSON.stringify({ brainDumpText: brainDumpRaw });

  // DATA ONLY — writes data + brain_dump_raw column. current_step not
  // touched on UPDATE; navigate_next handles the screen advance. INSERT
  // path defaults to step 3 (where the advanced brain-dump screen lives).
  const result = await db.query(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, brain_dump_raw, updated_at)
     VALUES ($1, 3, 'in_progress', $2::jsonb, $3, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       brain_dump_raw = $3,
       updated_at = now()`,
    [anonId, payload, brainDumpRaw],
  );

  console.log(`[vapi/tool] submit_brain_dump written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
