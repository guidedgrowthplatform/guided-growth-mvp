/**
 * Same-turn submit_brain_dump chunk merging (W2-D / F10 live-path follow-on).
 *
 * The model nondeterministically splits one brain dump across MULTIPLE
 * submit_brain_dump calls inside a single assistant turn (observed live on
 * the fix/braindump-live-path-w2d CI preview: 4 and 6 calls in one turn,
 * roughly one per habit). The handler persists each call with a full
 * overwrite (brain_dump_raw = $3, data || {brainDumpText}), so only the LAST
 * chunk survived and the advanced-frequency beat rendered a single habit
 * ("Drinking more water") with the user's other habits silently dropped.
 *
 * The route accumulates the turn's chunks with this helper and rewrites each
 * call's brain_dump_raw to the running union, so the handler's overwrite
 * semantics stay unchanged but the row always ends the turn holding every
 * chunk. Scoped to ONE request (= one assistant turn) on purpose: a
 * correction in a LATER user turn ("actually scratch that, just walking")
 * still replaces the dump wholesale, which is the existing, intended
 * correction path on this beat.
 *
 * Merge rules per incoming chunk (case-insensitive containment):
 *   - already covered by an accumulated chunk (model re-sent a fragment or
 *     the identical text): no change
 *   - covers one or more accumulated chunks (model re-sent a superset, the
 *     common full-dump retry): the subsumed chunks are replaced by it
 *   - otherwise (a genuinely new fragment, the per-habit split): appended
 */
export function mergeBrainDumpChunks(chunks: readonly string[], next: string): string[] {
  const n = next.trim();
  if (!n) return [...chunks];
  const nLower = n.toLowerCase();
  if (chunks.some((c) => c.toLowerCase().includes(nLower))) return [...chunks];
  const kept = chunks.filter((c) => !nLower.includes(c.toLowerCase()));
  return [...kept, n];
}

/** The accumulated turn text a rewritten submit_brain_dump call should carry. */
export function joinBrainDumpChunks(chunks: readonly string[]): string {
  return chunks.join('\n');
}
