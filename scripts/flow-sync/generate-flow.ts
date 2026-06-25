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
import { validateFlow } from '../../src/onboarding-flow/flowMachine';
import { DESIGNER_ONBOARDING_FLOW } from '../../src/onboarding-flow/transform/designerSource';
import { designerToFlowDocument } from '../../src/onboarding-flow/transform/designerToFlow';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(
  here,
  '../../src/onboarding-flow/flows/onboarding-beginner-v1.generated.json',
);

function main(): void {
  const flow = designerToFlowDocument(DESIGNER_ONBOARDING_FLOW);

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
}

main();
