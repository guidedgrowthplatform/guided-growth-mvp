/**
 * Same-turn duplicate tool-call dedupe (W2-E).
 *
 * Round-2 QA (docs/qa-rounds/round2-judge-2026-07-07.md) found three
 * independent instances of the model firing the SAME tool with the SAME
 * arguments twice inside one turn:
 *   - R21 (skipper): add_habit fires twice for an identical existing preset
 *     name, fails both times, coach silently abandons the habit.
 *   - R26 (rambler): duplicate/conflicting submit_goals calls back to back.
 *   - R20 (resister): add_habit double-fires at the habit-schedule beat.
 *
 * This is a request-scoped, exact-duplicate-only guard at the tool-dispatch
 * layer: if a call's (name, normalized args) exactly matches a call already
 * EXECUTED earlier in the same request/turn, skip re-execution and hand the
 * model the first call's result instead of an error, so it reads as success
 * and moves on rather than retrying blind or silently abandoning the task.
 *
 * Scope, deliberately narrow:
 *   - Exact-duplicate only. Two add_habit calls with different args (the
 *     documented two-call configure pattern: name-only, then a schedule-only
 *     edit) are NOT duplicates and both execute normally.
 *   - Request-scoped, no cross-turn memory — a correction or retry in a
 *     LATER user turn is unaffected.
 *   - submit_brain_dump is excluded. W2-D's brainDumpTurnMerge.ts already
 *     handles the model splitting one dump across several same-turn calls by
 *     merging them; treating those as duplicates-to-skip here would fight
 *     that mechanism instead of complementing it.
 */

// submit_brain_dump has its own same-turn merge (brainDumpTurnMerge.ts) —
// dedupe must not intercept it, or the two mechanisms fight each other.
export const DEDUPE_EXCLUDED_TOOLS = new Set<string>(['submit_brain_dump']);

/** Stable key for (tool name, args) so key order / undefined values don't cause false negatives. */
export function toolCallDedupeKey(name: string, args: Record<string, unknown>): string {
  return `${name}::${stableStringify(args)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
  );
  return `{${entries.join(',')}}`;
}

/**
 * Tracks (name, args) keys already executed in this request. `has` checks
 * without recording; `record` marks a key as executed once its real result
 * is known, so the FIRST occurrence of a pair always actually runs.
 */
export class SameTurnToolDedupe {
  private readonly seen = new Map<string, unknown>();

  shouldSkip(name: string, args: Record<string, unknown>): boolean {
    if (DEDUPE_EXCLUDED_TOOLS.has(name)) return false;
    return this.seen.has(toolCallDedupeKey(name, args));
  }

  /** Result from the first, real execution of this (name, args) pair. */
  priorResult(name: string, args: Record<string, unknown>): unknown {
    return this.seen.get(toolCallDedupeKey(name, args));
  }

  record(name: string, args: Record<string, unknown>, result: unknown): void {
    if (DEDUPE_EXCLUDED_TOOLS.has(name)) return;
    this.seen.set(toolCallDedupeKey(name, args), result);
  }
}
