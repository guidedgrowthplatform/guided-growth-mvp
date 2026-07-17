/**
 * Generate src/generated/onboarding_combined.json — the single unified per-beat
 * view the team asked for: engine metadata AND coach context in one JSON.
 *
 * This is a GENERATED merge of the two existing sources, not a new source of
 * truth. Nothing the coach or frontend reads at runtime changes:
 *   - engine metadata (voiceEngine, mode, mp3 clip, fill brain, toggles, engine)
 *       ← the flow builder, via onboarding-beginner-v1.generated.json node.meta
 *         (authored in designer-source.json, produced by npm run flow:sync)
 *   - coach context, opener, and allowed tools
 *       ← contract-generated beat_contexts.json
 *   - globalContext
 *       ← contract-generated beat_contexts.json
 *
 * So this file lets anyone see everything about a beat in one place. The onboarding
 * contract is the source for coach context and tools; the flow builder remains
 * the source for engine metadata. Re-run after either changes.
 *
 *   npx tsx scripts/build-onboarding-combined.ts
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import beatContexts from '../src/generated/beat_contexts.json';
import flow from '../src/onboarding-flow/flows/onboarding-beginner-v1.generated.json';

interface FlowNode {
  id: string;
  screenId: string;
  componentType?: string;
  meta?: unknown;
}
const nodes = flow.nodes as FlowNode[];
const contexts = beatContexts.beats as Record<
  string,
  { context?: string; opener?: string; allowedTools?: string[] }
>;

const beats = nodes.map((n) => {
  const ctx = contexts[n.screenId];
  return {
    id: n.id,
    screenId: n.screenId,
    componentType: n.componentType ?? null,
    // engine metadata (flow builder)
    meta: n.meta ?? null,
    // coach brain + tools (contract-generated) — null/empty if this beat has none
    coachContext: ctx?.context ?? null,
    opener: ctx?.opener ?? null,
    allowedTools: ctx?.allowedTools ?? [],
  };
});

const out = {
  _comment:
    'AUTO-GENERATED unified per-beat view by scripts/build-onboarding-combined.ts. ' +
    'Merges engine metadata (flow builder) + contract-generated coach context/opener/tools + global. ' +
    'Re-run after contract generation or flow generation. Do not edit by hand.',
  flowId: (flow as { id?: string }).id ?? 'onboarding-beginner-v1',
  contextVersion: beatContexts.bundleVersion,
  globalContext: beatContexts.global,
  beats,
};

const path = resolve(import.meta.dirname, '../src/generated/onboarding_combined.json');
writeFileSync(path, JSON.stringify(out, null, 2) + '\n', 'utf-8');
const withCtx = beats.filter((b) => b.coachContext).length;
const withMeta = beats.filter((b) => b.meta && Object.keys(b.meta as object).length > 0).length;
console.log(
  `Wrote src/generated/onboarding_combined.json (${beats.length} beats, ${withMeta} with engine metadata, ${withCtx} with coach context, global ${beatContexts.global.length} chars)`,
);
