import { ONBOARDING_TOOLS, type OnboardingToolDefinition } from './schemas.js';

export function isOnboardingScreen(screenId: string | null | undefined): boolean {
  return typeof screenId === 'string' && screenId.startsWith('ONBOARD-');
}

export function getOnboardingTools(
  screenId: string | null | undefined,
): readonly OnboardingToolDefinition[] | undefined {
  return isOnboardingScreen(screenId) ? ONBOARDING_TOOLS : undefined;
}
