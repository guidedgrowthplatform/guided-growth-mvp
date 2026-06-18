/**
 * submit_custom_prompts handler — writes the user's custom evening-reflection
 * prompts to onboarding_states.data.customPrompts.
 *
 * Auth model: see submitProfile.ts. Channel auth is X-Vapi-Secret;
 * identity arrives as `anon_id` injected by Vapi from static call params.
 *
 * Replace-not-append: the prompts array overwrites data.customPrompts.
 */
import pool from '../../db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_PROMPTS = 10;
const MAX_PROMPT_LEN = 280;

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

// Trim, drop empties, cap count + per-item length. Non-array OR any non-string
// item -> undefined (reject whole array, matching the shared Direct-LLM helper).
function getStringArray(args: Record<string, unknown>, key: string): string[] | undefined {
  const v = args[key];
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string') return undefined;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    out.push(trimmed.slice(0, MAX_PROMPT_LEN));
    if (out.length >= MAX_PROMPTS) break;
  }
  return out;
}

export async function submitCustomPrompts(args: Record<string, unknown>): Promise<HandlerResult> {
  console.log(
    '[vapi/tool] received name=submit_custom_prompts anon_id=' + getString(args, 'anon_id'),
  );

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  const customPrompts = getStringArray(args, 'prompts');
  if (customPrompts === undefined || customPrompts.length === 0) {
    console.log('[vapi/tool] validation_failed reason=prompts_required');
    return { error: 'validation_failed: prompts must be a non-empty array of strings' };
  }

  // Object payload so top-level `||` REPLACES the customPrompts key (never the bare array).
  // Defining prompts implies prompts mode.
  const payload = JSON.stringify({ customPrompts, reflectionMode: 'prompts' });

  // DATA ONLY — current_step not touched; navigate_next handles the advance.
  const result = await pool.query(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 6, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()`,
    [anonId, payload],
  );

  console.log(`[vapi/tool] submit_custom_prompts written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
