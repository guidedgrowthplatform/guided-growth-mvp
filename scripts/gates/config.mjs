import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

export const onboardingIdGate = {
  contractPath: 'src/onboarding-flow/flows/onboarding-contract.v1.json',
  runtimeRoots: ['api', 'src'],
  generatedCrosswalkPath: 'packages/shared/src/onboarding/beatIds.generated.ts',
  exactAllowlist: [
    'docs/migrations/onboarding-analytics-id-remap.generated.md',
    'docs/migrations/onboarding-analytics-id-remap.md',
  ],
  prefixAllowlist: ['supabase/migrations/', 'docs/audits/'],
};

export const writerGate = {
  roots: ['api', 'src', 'scripts'],
  baselinePath: 'scripts/gates/writer-baseline.json',
  ignoredPathPrefixes: ['scripts/gates/__fixtures__/'],
  tables: ['chat_messages', 'chat_sessions', 'session_log', 'beat_contexts', 'screen_contexts'],
};

export const driftGate = {
  regenerateCommand: ['npm', 'run', 'onboarding:generate'],
  generatedArtifacts: [
    'packages/shared/src/onboarding/beatIds.generated.ts',
    'src/onboarding-flow/flows/evening-checkin-v1.generated.json',
    'src/onboarding-flow/flows/home-tour-v1.generated.json',
    'src/onboarding-flow/flows/lane-a-demo-v1.generated.json',
    'src/onboarding-flow/flows/morning-checkin-v1.generated.json',
    'src/onboarding-flow/flows/onboarding-beginner-v1.generated.json',
    'src/onboarding-flow/flows/weekly-checkin-v1.generated.json',
  ],
};
