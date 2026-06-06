import pool from '../../db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_CATEGORIES = new Set([
  'fitness',
  'nutrition',
  'health',
  'social',
  'mission',
  'work',
  'purchase',
  'wishlist',
  'media',
  'place',
  'reflection',
  'intention',
  'misc',
]);
const VALID_KINDS = new Set(['did', 'want', 'plan', 'felt']);
const CONTENT_MAX_LEN = 8000;

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

export async function logEntry(args: Record<string, unknown>): Promise<HandlerResult> {
  console.log('[vapi/tool] received name=log_entry anon_id=' + getString(args, 'anon_id'));

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity name=log_entry');
    return { error: 'invalid_identity' };
  }

  const content = getString(args, 'content')?.trim();
  if (!content) {
    console.log('[vapi/tool] validation_failed reason=content_required name=log_entry');
    return { error: 'validation_failed: content is required' };
  }
  if (content.length > CONTENT_MAX_LEN) {
    return { error: `validation_failed: content exceeds ${CONTENT_MAX_LEN} characters` };
  }

  const category = getString(args, 'category') ?? null;
  if (category !== null && !VALID_CATEGORIES.has(category)) {
    return { error: 'validation_failed: invalid category' };
  }

  const kind = getString(args, 'kind') ?? null;
  if (kind !== null && !VALID_KINDS.has(kind)) {
    return { error: 'validation_failed: invalid kind' };
  }

  let structured: Record<string, unknown> | null = null;
  if (args.structured !== undefined) {
    if (
      typeof args.structured !== 'object' ||
      args.structured === null ||
      Array.isArray(args.structured)
    ) {
      return { error: 'validation_failed: structured must be an object' };
    }
    structured = args.structured as Record<string, unknown>;
  }

  await pool.query(
    `INSERT INTO user_logs (anon_id, content, category, kind, structured, source)
     VALUES ($1, $2, $3, $4, $5, 'voice')`,
    [anonId, content, category, kind, structured ? JSON.stringify(structured) : null],
  );

  console.log('[vapi/tool] log_entry written anon_id=' + anonId);
  return { result: 'ok' };
}
