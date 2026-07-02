/**
 * Generate src/generated/onboarding_combined.json — the single unified per-beat
 * view the team asked for: engine metadata AND coach context in one JSON.
 *
 * This is a GENERATED merge of the two existing sources, not a new source of
 * truth. Nothing the coach or frontend reads at runtime changes:
 *   - engine metadata (voiceEngine, mode, mp3 clip, fill brain, toggles, engine)
 *       ← the flow builder, via onboarding-beginner-v1.generated.json node.meta
 *         (authored in designer-source.json, produced by npm run flow:sync)
 *   - coach context + opener
 *       ← beatContexts.ts (Master Sheet "Beats Context" tab, synced in)
 *   - globalContext
 *       ← GLOBAL_ONBOARDING_CONTEXT
 *
 * So this file lets anyone see everything about a beat in one place. The Sheet
 * stays the source for context and the builder stays the source for metadata;
 * re-run this after `npm run flow:sync` or a context sync. Making THIS file the
 * single authored source (dropping the Sheet for context) is a separate, team
 * decision, not done here.
 *
 *   npx tsx scripts/build-onboarding-combined.ts
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  BEAT_CONTEXTS,
  GLOBAL_ONBOARDING_CONTEXT,
  BEAT_CONTEXT_VERSION,
} from '../api/_lib/llm/onboarding/beatContexts.ts';
import flow from '../src/onboarding-flow/flows/onboarding-beginner-v1.generated.json';

interface FlowNode {
  id: string;
  screenId: string;
  componentType?: string;
  meta?: unknown;
}
const nodes = flow.nodes as FlowNode[];

const beats = nodes.map((n) => {
  const ctx = BEAT_CONTEXTS[n.screenId as keyof typeof BEAT_CONTEXTS] as
    | { context?: string; opener?: string }
    | undefined;
  return {
    id: n.id,
    screenId: n.screenId,
    componentType: n.componentType ?? null,
    // engine metadata (flow builder)
    meta: n.meta ?? null,
    // coach brain (beatContexts.ts, Sheet-synced) — null if this beat has none
    coachContext: ctx?.context ?? null,
    opener: ctx?.opener ?? null,
  };
});

const out = {
  _comment:
    'AUTO-GENERATED unified per-beat view by scripts/build-onboarding-combined.ts. ' +
    'Merges engine metadata (flow builder) + coach context/opener (beatContexts.ts, Sheet-synced) + global. ' +
    'Sources of truth unchanged. Re-run after flow:sync or a context sync. Do not edit by hand.',
  flowId: (flow as { id?: string }).id ?? 'onboarding-beginner-v1',
  contextVersion: BEAT_CONTEXT_VERSION,
  globalContext: GLOBAL_ONBOARDING_CONTEXT,
  beats,
};

const path = resolve(import.meta.dirname, '../src/generated/onboarding_combined.json');
writeFileSync(path, JSON.stringify(out, null, 2) + '\n', 'utf-8');
const withCtx = beats.filter((b) => b.coachContext).length;
const withMeta = beats.filter((b) => b.meta && Object.keys(b.meta as object).length > 0).length;
console.log(
  `Wrote src/generated/onboarding_combined.json (${beats.length} beats, ${withMeta} with engine metadata, ${withCtx} with coach context, global ${GLOBAL_ONBOARDING_CONTEXT.length} chars)`,
);
