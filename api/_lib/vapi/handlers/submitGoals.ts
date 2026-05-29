/**
 * submit_goals handler — writes the user's selected goals (max 2)
 * to onboarding_states.data.goals.
 *
 * Auth model: see submitProfile.ts. Channel auth is X-Vapi-Secret;
 * identity arrives as `anon_id` injected by Vapi from static call params.
 *
 * Server-side validation: each goal must be in the allowed list for the
 * user's previously chosen category. If category is missing, accept any
 * 1-2 string goals (user may be coming from a non-standard path).
 *
 * REPLACE semantics (intentional): the write below uses a shallow JSONB
 * merge, so each call REPLACES data.goals wholesale rather than appending.
 * The tool contract (tools.onboarding.ts submit_goals) requires the LLM to
 * send the COMPLETE current selection every call. This keeps voice in sync
 * with the manual toggle UI (also replace-based) and lets the user correct
 * a selection ("walk more — no, exercise instead") without the dropped goal
 * lingering. Do NOT switch this to array-append: it would resurrect goals
 * the user removed.
 *
 * DRIFT WARNING: GOALS_BY_CATEGORY below mirrors src/data/onboardingHabits.ts
 * goalsByCategory. Keep in sync — voice and manual flows must produce the
 * same shape.
 */
import pool from '../../db.js';
import { MAX_GOALS } from '../../llm/tools.onboarding.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HandlerResult = { result: string } | { error: string };

// DRIFT WARNING: mirrors src/data/onboardingHabits.ts goalsByCategory.
const GOALS_BY_CATEGORY: Record<string, readonly string[]> = {
  'Sleep better': [
    'Fall asleep earlier',
    'Wake up earlier',
    'Sleep more consistently',
    'Sleep more deeply',
  ],
  'Move more': ['Walk more', 'Exercise consistently', 'Improve mobility'],
  'Eat better': ['Eat more intentionally', 'Reduce overeating', 'Plan food better'],
  'Feel more energized': [
    'Have more morning energy',
    'Avoid afternoon crashes',
    'Keep energy more stable',
  ],
  'Reduce stress': ['Feel calmer during the day', 'Reduce evening stress', 'Feel less overwhelmed'],
  'Improve focus': ['Start work with less friction', 'Do deeper work', 'Procrastinate less'],
  'Break bad habits': [
    'Smoking',
    'Weed',
    'Alcohol',
    'Porn',
    'Phone use',
    'Late-night snacking',
    'Caffeine',
  ],
  'Get more organized': ['Stay on top of tasks', 'Keep spaces tidy', 'Handle life admin better'],
};

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

function getStringArray(args: Record<string, unknown>, key: string): string[] | undefined {
  const v = args[key];
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string') return undefined;
    out.push(item);
  }
  return out;
}

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3),
  );
}

/**
 * Best-effort match an LLM-supplied goal string against the per-category
 * allowed list. Tries (in order):
 *   1. Case-insensitive exact match.
 *   2. Word-boundary containment — input is contained in the canonical
 *      (e.g. "fall asleep" → "Fall asleep earlier"). The reverse direction
 *      is intentionally NOT supported: it lets short inputs like "earlier"
 *      match "Fall asleep earlier" by accident.
 *   3. Token overlap — at least 2 shared meaningful (≥3 char) tokens, OR
 *      every token in the smaller set when the smaller set has just one.
 * Returns the canonical allowed string when a match is found, else null.
 */
function findClosestGoal(input: string, allowed: readonly string[]): string | null {
  const inputLower = input.trim().toLowerCase();
  if (!inputLower) return null;
  const exact = allowed.find((g) => g.toLowerCase() === inputLower);
  if (exact) return exact;
  // Word-boundary containment: canonical contains the full input as a word.
  // Padding both sides with spaces forces alignment on whitespace.
  const padded = ` ${inputLower} `;
  const sub = allowed.find((g) => ` ${g.toLowerCase()} `.includes(padded));
  if (sub) return sub;
  const inputTokens = tokens(inputLower);
  if (inputTokens.size === 0) return null;
  let bestMatch: string | null = null;
  let bestScore = 0;
  for (const g of allowed) {
    const gTokens = tokens(g);
    if (gTokens.size === 0) continue;
    let overlap = 0;
    for (const t of inputTokens) if (gTokens.has(t)) overlap++;
    // Require at least 2 shared tokens, unless one side has only 1 token
    // (e.g. "Caffeine" — single-word canonical) in which case full overlap
    // of that token is enough.
    const smaller = Math.min(inputTokens.size, gTokens.size);
    const minRequired = smaller === 1 ? 1 : 2;
    if (overlap >= minRequired && overlap > bestScore) {
      bestScore = overlap;
      bestMatch = g;
    }
  }
  return bestMatch;
}

export async function submitGoals(args: Record<string, unknown>): Promise<HandlerResult> {
  console.log('[vapi/tool] received name=submit_goals anon_id=' + getString(args, 'anon_id'));

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  const goals = getStringArray(args, 'goals');
  if (goals === undefined) {
    console.log('[vapi/tool] validation_failed reason=goals_not_array');
    return { error: 'validation_failed: goals must be an array of strings' };
  }
  if (goals.length === 0) {
    console.log('[vapi/tool] validation_failed reason=goals_empty');
    return { error: 'validation_failed: goals must have at least one entry' };
  }
  console.log(`[vapi/tool] submit_goals input goals=${JSON.stringify(goals)}`);

  // Read user's chosen category to scope allowed goals (if any).
  const catRes = await pool.query<{ category: string | null }>(
    `SELECT data->>'category' AS category FROM onboarding_states WHERE anon_id = $1`,
    [anonId],
  );
  const category = catRes.rows[0]?.category ?? null;

  let validated: string[];
  if (category && GOALS_BY_CATEGORY[category]) {
    const allowed = GOALS_BY_CATEGORY[category];
    // Map each LLM-supplied goal to the closest allowed canonical form
    // (fuzzy: exact → substring → token overlap). Drop ones that don't match.
    const matches: string[] = [];
    for (const g of goals) {
      const canonical = findClosestGoal(g, allowed);
      if (canonical && !matches.includes(canonical)) matches.push(canonical);
    }
    validated = matches;
    if (validated.length === 0) {
      console.log(
        `[vapi/tool] validation_failed reason=goals_none_in_allowed_list category=${category} input=${JSON.stringify(goals)} allowed=${JSON.stringify(allowed)}`,
      );
      return { error: 'validation_failed: no submitted goal matches the chosen category' };
    }
    console.log(
      `[vapi/tool] submit_goals fuzzy-matched ${JSON.stringify(goals)} → ${JSON.stringify(validated)}`,
    );
  } else {
    // No category set — accept any non-empty strings.
    validated = goals.filter((g) => g.length > 0 && g.length <= 100);
    if (validated.length === 0) {
      console.log('[vapi/tool] validation_failed reason=goals_all_blank');
      return { error: 'validation_failed: goals must be non-empty strings' };
    }
  }

  // Cap at MAX_GOALS (2).
  const finalGoals = validated.slice(0, MAX_GOALS);
  const payload = JSON.stringify({ goals: finalGoals });

  // DATA ONLY — current_step not touched on UPDATE; navigate_next handles
  // the screen advance. INSERT path defaults to step 4 (goals).
  const result = await pool.query(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 4, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()`,
    [anonId, payload],
  );

  console.log(`[vapi/tool] submit_goals written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
