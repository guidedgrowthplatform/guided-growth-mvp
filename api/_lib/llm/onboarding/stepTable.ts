// Single source of truth for Direct-LLM onboarding step numbering. Vapi keeps its own.

export type StepRequirement =
  | 'nickname'
  | 'path'
  | 'categoryOrBraindump'
  | 'goals'
  | 'habits'
  | 'reflection'
  | null;

export interface OnboardingStepDef {
  step: number;
  label: string;
  requires: StepRequirement;
}

export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  { step: 1, label: 'profile', requires: 'nickname' },
  { step: 2, label: 'path', requires: 'path' },
  { step: 3, label: 'category/braindump', requires: 'categoryOrBraindump' },
  { step: 4, label: 'goals', requires: 'goals' },
  { step: 5, label: 'habits', requires: 'habits' },
  { step: 6, label: 'reflection', requires: 'reflection' },
  { step: 7, label: 'plan review', requires: null },
] as const;

export const FIRST_STEP = ONBOARDING_STEPS[0].step;
export const LAST_STEP = ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1].step;
// 1–10 clamp: advanced-path / edit-revisit slack beyond the linear core.
export const MAX_DB_STEP = 10;

// Several screens share a step (habit variants).
export const SCREEN_STEP: Readonly<Record<string, number>> = {
  'ONBOARD-01--FORM': 1,
  'ONBOARD-FORK--FORM': 2,
  'ONBOARD-BEGINNER-01': 3,
  'ONBOARD-BEGINNER-02': 4,
  'ONBOARD-BEGINNER-03': 5,
  'ONBOARD-BEGINNER-04': 5,
  'ONBOARD-BEGINNER-05': 5,
  'ONBOARD-BEGINNER-07': 6,
  'ONBOARD-BEGINNER-06': 7,
};

export function stepRequirement(sourceStep: number): StepRequirement {
  return ONBOARDING_STEPS.find((s) => s.step === sourceStep)?.requires ?? null;
}

export function renderStepProgressionLine(): string {
  return ONBOARDING_STEPS.filter((s) => s.step < LAST_STEP)
    .map((s) => `${s.label}(${s.step})→${s.step + 1}`)
    .join(', ');
}
