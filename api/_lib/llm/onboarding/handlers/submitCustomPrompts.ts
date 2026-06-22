import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { getStringArray, invalid, ok, type OnboardingHandlerCtx } from './shared.js';

const MAX_PROMPTS = 10;
const MAX_PROMPT_LEN = 280;

export async function submitCustomPrompts(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const raw = getStringArray(args, 'prompts');
  if (raw === undefined) return invalid('prompts must be an array of strings');

  const customPrompts = raw
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, MAX_PROMPTS)
    .map((p) => p.slice(0, MAX_PROMPT_LEN));
  if (customPrompts.length === 0)
    return invalid('prompts must contain at least one non-empty string');

  // Object payload so top-level `||` REPLACES the customPrompts key (never the bare array).
  // Defining prompts implies prompts mode.
  const payload = JSON.stringify({ customPrompts, reflectionMode: 'prompts' });

  await pool.query(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 6, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()`,
    [ctx.anon_id, payload],
  );

  return ok({ customPrompts });
}
