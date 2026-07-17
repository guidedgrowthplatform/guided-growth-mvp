/** Emit @gg/shared/onboarding/beatIds from a Phase A onboarding contract. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderBeatIdsModule } from './lib/generateBeatIds';
import { readOnboardingContract } from './lib/readContract';

const here = dirname(fileURLToPath(import.meta.url));
const contractPath = process.env.ONBOARDING_CONTRACT_PATH ?? resolve(here, '../../src/onboarding-flow/flows/onboarding-contract.v1.json');
const outputPath = resolve(here, '../../packages/shared/src/onboarding/beatIds.ts');
const contract = readOnboardingContract(contractPath).contract;
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, renderBeatIdsModule(contract), 'utf8');
console.log(`[beat-ids] wrote ${outputPath} from ${contractPath}`);
