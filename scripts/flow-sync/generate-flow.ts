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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFlowAuthoring } from '../../src/onboarding-flow/flowMachine';
import {
  DESIGNER_ONBOARDING_FLOW_FROM_JSON,
  designerBeatsFromExport,
  parseExportDocument,
} from '../../src/onboarding-flow/transform/designerSourceJson';
import { designerToFlowDocument } from '../../src/onboarding-flow/transform/designerToFlow';
import type { FlowDocument } from '../../src/onboarding-flow/types';

const here = dirname(fileURLToPath(import.meta.url));
const FLOWS_DIR = resolve(here, '../../src/onboarding-flow/flows');
const OUT_PATH = resolve(FLOWS_DIR, 'onboarding-beginner-v1.generated.json');

// Linear flows shipped from the builder: one Export in, one generated flow out.
const LINEAR_EXPORTS = [
  { source: 'designer-source.morning-checkin.json', out: 'morning-checkin-v1.generated.json' },
  { source: 'designer-source.evening-checkin.json', out: 'evening-checkin-v1.generated.json' },
  { source: 'designer-source.home-tour.json', out: 'home-tour-v1.generated.json' },
];

function gateAndWrite(flow: FlowDocument, outPath: string): void {
  // Authoring validation: graph integrity + meta presence + persist.step invariants.
  const problems = validateFlowAuthoring(flow);
  if (problems.length > 0) {
    console.error('[flow:sync] ' + flow.flowId + ' failed validation:');
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(flow, null, 2) + '\n', 'utf8');
  console.log(
    '[flow:sync] wrote ' +
      outPath +
      ' (' +
      flow.nodes.length +
      ' nodes, entry=' +
      flow.entryNodeId +
      ')',
  );
}

function main(): void {
  // The builder Export IS the source of truth; a broken or empty Export fails
  // the zod parse loud (L1-1), so no hand-typed mirror fallback exists anymore.
  const source = DESIGNER_ONBOARDING_FLOW_FROM_JSON;
  console.log('[flow:sync] source = designer-source.json (' + source.length + ' beats)');
  gateAndWrite(designerToFlowDocument(source), OUT_PATH);

  for (const entry of LINEAR_EXPORTS) {
    const doc = parseExportDocument(
      JSON.parse(readFileSync(resolve(FLOWS_DIR, entry.source), 'utf8')),
    );
    const flow = designerToFlowDocument(designerBeatsFromExport(doc), {
      flowId: doc.flowId,
      ...(doc.name ? { name: doc.name } : {}),
      ...(doc.version != null ? { version: doc.version } : {}),
      ...(doc.publishedAt ? { publishedAt: doc.publishedAt } : {}),
    });
    gateAndWrite(flow, resolve(FLOWS_DIR, entry.out));
  }
}

main();
