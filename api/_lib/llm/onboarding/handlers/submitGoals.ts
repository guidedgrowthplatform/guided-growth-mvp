import { goalsByCategory as GOALS_BY_CATEGORY } from '@gg/shared/data/onboardingGoals';
import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { MAX_GOALS } from '../schemas.js';
import { getStringArray, invalid, ok, type OnboardingHandlerCtx } from './shared.js';

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3),
  );
}

function findClosestGoal(input: string, allowed: readonly string[]): string | null {
  const inputLower = input.trim().toLowerCase();
  if (!inputLower) return null;
  const exact = allowed.find((g) => g.toLowerCase() === inputLower);
  if (exact) return exact;
  const sub = allowed.find(
    (g) => g.toLowerCase().includes(inputLower) || inputLower.includes(g.toLowerCase()),
  );
  if (sub) return sub;
  const inputTokens = tokens(inputLower);
  let bestMatch: string | null = null;
  let bestScore = 0;
  let bestRatio = 0;
  for (const g of allowed) {
    const gTokens = tokens(g);
    let overlap = 0;
    for (const t of inputTokens) if (gTokens.has(t)) overlap++;
    const minRequired = Math.max(1, Math.ceil(Math.min(inputTokens.size, gTokens.size) / 2));
    if (overlap < minRequired) continue;
    // Higher overlap wins; ties break on token-overlap ratio (not array order).
    const ratio = overlap / Math.max(inputTokens.size, gTokens.size);
    if (overlap > bestScore || (overlap === bestScore && ratio > bestRatio)) {
      bestScore = overlap;
      bestRatio = ratio;
      bestMatch = g;
    }
  }
  return bestMatch;
}

export async function submitGoals(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const goals = getStringArray(args, 'goals');
  if (goals === undefined) return invalid('goals must be an array of strings');
  if (goals.length === 0) return invalid('goals must have at least one entry');

  const catRes = await pool.query<{ category: string | null }>(
    `SELECT data->>'category' AS category FROM onboarding_states WHERE anon_id = $1`,
    [ctx.anon_id],
  );
  const category = catRes.rows[0]?.category ?? null;

  let validated: string[];
  const dropped: string[] = [];
  if (category && GOALS_BY_CATEGORY[category]) {
    const allowed = GOALS_BY_CATEGORY[category];
    const matches: string[] = [];
    for (const g of goals) {
      const canonical = findClosestGoal(g, allowed);
      if (canonical && !matches.includes(canonical)) matches.push(canonical);
      else if (!canonical) dropped.push(g);
    }
    validated = matches;
    if (validated.length === 0) {
      return invalid(
        `None of the submitted goals match "${category}". Re-call submit_goals using EXACTLY one or two of these labels, verbatim: ${allowed.join(' | ')}. Do not paraphrase.`,
      );
    }
  } else {
    validated = goals.filter((g) => g.length > 0 && g.length <= 100);
    if (validated.length === 0) return invalid('goals must be non-empty strings');
  }

  const finalGoals = validated.slice(0, MAX_GOALS);
  if (validated.length > MAX_GOALS) dropped.push(...validated.slice(MAX_GOALS));
  const payload = JSON.stringify({ goals: finalGoals });

  const result = await pool.query<{ data: Record<string, unknown>; current_step: number }>(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 5, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       current_step = GREATEST(onboarding_states.current_step, 5),
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()
     RETURNING data, current_step`,
    [ctx.anon_id, payload],
  );

  const row = result.rows[0];
  return ok({
    data: row?.data ?? { goals: finalGoals },
    current_step: row?.current_step ?? 5,
    goals: finalGoals,
    ...(dropped.length > 0 ? { dropped } : {}),
  });
}
