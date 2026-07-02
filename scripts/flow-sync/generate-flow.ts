/**
 * Flow sync: regenerate the engine flow JSON from the designer source of truth.
 *
 * Reads the mirrored designer DEFAULT_FLOW (src/onboarding-flow/transform/
 * designerSource.ts), runs the transform, validates the result against the engine
 * flow machine, and writes src/onboarding-flow/flows/onboarding-beginner-v1.generated.json.
 *
 * Run: npm run flow:sync
 *
 * The generated JSON is what the engine loads at runtime (useFlow.ts), with a safe
 * fallback to the hand-authored TS flow if the JSON is missing or invalid. So this
 * script is the bridge: change the designer, re-run, and the running flow updates
 * with no code build. See src/onboarding-flow/flows/README-flow-sync.md.
 *
 * NO EM DASHES.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import designerSourceRaw from '../../src/onboarding-flow/flows/designer-source.json';
import { validateFlow } from '../../src/onboarding-flow/flowMachine';
import { ONBOARDING_TOOL_NAMES } from '../../api/_lib/llm/onboarding/schemas';
import { buildFlowBeatMeta } from '../../src/onboarding-flow/transform/buildFlowBeatMeta';
import { DESIGNER_ONBOARDING_FLOW } from '../../src/onboarding-flow/transform/designerSource';
import { DESIGNER_ONBOARDING_FLOW_FROM_JSON } from '../../src/onboarding-flow/transform/designerSourceJson';
import { designerToFlowDocument } from '../../src/onboarding-flow/transform/designerToFlow';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(
  here,
  '../../src/onboarding-flow/flows/onboarding-beginner-v1.generated.json',
);
const BEAT_META_OUT_PATH = resolve(
  here,
  '../../api/_lib/llm/onboarding/flowBeatMeta.generated.json',
);

function main(): void {
  // Drive from the builder Export JSON (the real source of truth). Fall back to
  // the hand-typed mirror only if the Export is empty or missing, so a broken
  // paste never wipes the flow.
  const source =
    DESIGNER_ONBOARDING_FLOW_FROM_JSON.length > 0
      ? DESIGNER_ONBOARDING_FLOW_FROM_JSON
      : DESIGNER_ONBOARDING_FLOW;
  if (DESIGNER_ONBOARDING_FLOW_FROM_JSON.length === 0) {
    console.warn('[flow:sync] designer-source.json is empty; falling back to the TS mirror.');
  } else {
    console.log('[flow:sync] source = designer-source.json (' + source.length + ' beats)');
  }
  const flow = designerToFlowDocument(source);

  const problems = validateFlow(flow);
  if (problems.length > 0) {
    console.error('[flow:sync] generated flow failed validation:');
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(flow, null, 2) + '\n', 'utf8');

  console.log('[flow:sync] wrote ' + OUT_PATH);
  console.log('[flow:sync] ' + flow.nodes.length + ' nodes, entry=' + flow.entryNodeId);

  // Per-beat coach meta for the Direct-LLM prompt (api reads flowBeatMeta.generated.json).
  const beatMeta = buildFlowBeatMeta(designerSourceRaw, ONBOARDING_TOOL_NAMES);
  for (const w of beatMeta.warnings) console.warn('[flow:sync] ' + w);
  if (beatMeta.errors.length > 0) {
    console.error('[flow:sync] beat meta failed validation:');
    for (const e of beatMeta.errors) console.error('  - ' + e);
    process.exit(1);
  }
  writeFileSync(BEAT_META_OUT_PATH, JSON.stringify(beatMeta.meta, null, 2) + '\n', 'utf8');
  console.log(
    '[flow:sync] wrote ' +
      BEAT_META_OUT_PATH +
      ' (' +
      Object.keys(beatMeta.meta).length +
      ' beats)',
  );
}

main();
