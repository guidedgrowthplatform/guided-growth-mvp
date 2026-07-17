import { resolve } from 'node:path';

export const repositoryRoot = resolve(import.meta.dirname, '../..');
export const contractPath = resolve(
  repositoryRoot,
  'src/onboarding-flow/flows/onboarding-contract.v1.json',
);

export const contextOutputs = {
  backend: 'api/_lib/llm/onboarding/beatContexts.generated.json',
  backendMeta: 'api/_lib/llm/onboarding/beatContexts.generated.meta.json',
  frontend: 'src/generated/beat_contexts.json',
  frontendMeta: 'src/generated/beat_contexts.meta.json',
} as const;
