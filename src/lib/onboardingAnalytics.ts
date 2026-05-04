import { track } from '@/analytics';

const STEP_START_PREFIX = 'gg_onboarding_step_started_at:';

export type AnalyticsOnboardingPath = 'beginner' | 'advanced';

export function resolveOnboardingPath(
  path: 'simple' | 'braindump' | 'advanced' | null | undefined,
): AnalyticsOnboardingPath {
  return path === 'braindump' || path === 'advanced' ? 'advanced' : 'beginner';
}

export function markOnboardingStepStart(stepKey: string): void {
  window.sessionStorage.setItem(`${STEP_START_PREFIX}${stepKey}`, String(Date.now()));
}

function getOnboardingStepDurationSeconds(stepKey: string): number | undefined {
  const startedAt = Number.parseInt(
    window.sessionStorage.getItem(`${STEP_START_PREFIX}${stepKey}`) ?? '',
    10,
  );
  if (!Number.isFinite(startedAt) || startedAt <= 0) return undefined;
  return Math.max(0, Math.round((Date.now() - startedAt) / 1000));
}

export function trackOnboardingStepComplete(input: {
  stepKey: string;
  stepNumber: number;
  stepName: string;
  onboardingPath: AnalyticsOnboardingPath;
}): void {
  track('complete_onboarding_step', {
    step_number: input.stepNumber,
    step_name: input.stepName,
    onboarding_path: input.onboardingPath,
    time_on_step_seconds: getOnboardingStepDurationSeconds(input.stepKey),
  });
}

export function bumpOnboardingCounter(counterKey: string): number {
  const current = Number.parseInt(window.sessionStorage.getItem(counterKey) ?? '0', 10) || 0;
  const next = current + 1;
  window.sessionStorage.setItem(counterKey, String(next));
  return next;
}
