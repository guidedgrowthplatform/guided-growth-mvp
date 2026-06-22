import type { ToolResult } from '../../tools.js';
import {
  readReflectionSettings,
  upsertReflectionSettings,
  validateReflectionUpdate,
} from '../../../reflection/reflectionSettings.js';
import { getString, getStringArray, invalid, ok, type CheckinHandlerCtx } from './shared.js';

// Runtime edit of the user's reflection setup (mode + guided questions). Reuses
// the same validate + upsert path as PUT /api/reflections/config. Replace
// semantics on prompts — the LLM sends the COMPLETE intended list.
export async function updateReflection(
  ctx: CheckinHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const mode = getString(args, 'mode');
  const prompts = getStringArray(args, 'prompts');
  // getStringArray returns undefined for both "absent" and "present but
  // malformed". A malformed list must error, not be silently dropped (which
  // would report success with unchanged prompts).
  if (args.prompts !== undefined && prompts === undefined) {
    return invalid('prompts must be an array of strings');
  }
  // Empty prompt list in prompts mode would silently reset to defaults — reject
  // and steer toward freeform instead (don't pretend "remove all" succeeded).
  if (prompts !== undefined && prompts.length === 0 && mode !== 'freeform') {
    return invalid('send at least one prompt, or switch to freeform to have no questions');
  }
  if (mode === undefined && prompts === undefined) {
    return invalid('provide mode and/or prompts to update');
  }

  const update: Record<string, unknown> = {};
  if (mode !== undefined) update.mode = mode;
  if (prompts !== undefined) update.prompts = prompts;

  const base = await readReflectionSettings(ctx.anon_id);
  const validated = validateReflectionUpdate(update, base);
  if (!validated.ok) return invalid(validated.error);

  const saved = await upsertReflectionSettings(ctx.anon_id, validated.value);
  return ok({ mode: saved.mode, prompts: saved.prompts });
}
