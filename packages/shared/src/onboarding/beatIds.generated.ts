// GENERATED FILE — v1 compatibility values until the Phase B generator owns this module.

export const GENERATED_FROM = {
  contractRevision: 'v1-current-session-log-ids',
  contractSha256: 'pending-phase-a-contract',
} as const;

export const ONBOARDING_BEAT_IDS = [
  'ONBOARD-01',
  'ONBOARD-FORK',
  'ONBOARD-BEGINNER-01',
  'ONBOARD-BEGINNER-02',
  'ONBOARD-BEGINNER-03',
  'ONBOARD-BEGINNER-04',
  'ONBOARD-BEGINNER-07',
  'ONBOARD-ADVANCED',
  'ONBOARD-ADVANCED-02',
  'ONBOARD-ADVANCED-04',
  'ONBOARD-ADVANCED-05',
  'STARTING-PLAN',
] as const;

export type OnboardingBeatId = (typeof ONBOARDING_BEAT_IDS)[number];

export const LEGACY_TO_CANONICAL_ONBOARDING_BEAT_ID = {
  onboard_01: 'ONBOARD-01',
  onboard_02: 'ONBOARD-FORK',
  onboard_03: 'ONBOARD-BEGINNER-01',
  onboard_04: 'ONBOARD-BEGINNER-02',
  onboard_05: 'ONBOARD-BEGINNER-03',
  onboard_06: 'ONBOARD-BEGINNER-04',
  onboard_07: 'STARTING-PLAN',
  onboard_08: 'ONBOARD-BEGINNER-07',
  onboard_advanced_input: 'ONBOARD-ADVANCED',
  onboard_advanced_results: 'ONBOARD-ADVANCED-02',
  onboard_advanced_step_6: 'ONBOARD-ADVANCED-04',
  onboard_advanced_custom_prompts: 'ONBOARD-ADVANCED-05',
} as const satisfies Record<string, OnboardingBeatId>;

export const CANONICAL_TO_LEGACY_ONBOARDING_BEAT_IDS = {
  'ONBOARD-01': ['onboard_01'],
  'ONBOARD-FORK': ['onboard_02'],
  'ONBOARD-BEGINNER-01': ['onboard_03'],
  'ONBOARD-BEGINNER-02': ['onboard_04'],
  'ONBOARD-BEGINNER-03': ['onboard_05'],
  'ONBOARD-BEGINNER-04': ['onboard_06'],
  'ONBOARD-BEGINNER-07': ['onboard_08'],
  'ONBOARD-ADVANCED': ['onboard_advanced_input'],
  'ONBOARD-ADVANCED-02': ['onboard_advanced_results'],
  'ONBOARD-ADVANCED-04': ['onboard_advanced_step_6'],
  'ONBOARD-ADVANCED-05': ['onboard_advanced_custom_prompts'],
  'STARTING-PLAN': ['onboard_07'],
} as const satisfies Record<OnboardingBeatId, readonly string[]>;

export const VARIANT_TO_BASE_ONBOARDING_BEAT_ID = {} as const;

export const VAPI_ONBOARDING_BEAT_IDS = new Set<OnboardingBeatId>();
export const MP3_ONBOARDING_BEAT_IDS = new Set<OnboardingBeatId>();
export const HYBRID_ONBOARDING_BEAT_IDS = new Set<OnboardingBeatId>();

const canonicalIds = new Set<string>(ONBOARDING_BEAT_IDS);

export function isOnboardingBeatId(value: string): value is OnboardingBeatId {
  return canonicalIds.has(value);
}

export function resolveOnboardingBeatId(value: string): OnboardingBeatId | undefined {
  if (isOnboardingBeatId(value)) return value;
  return LEGACY_TO_CANONICAL_ONBOARDING_BEAT_ID[
    value as keyof typeof LEGACY_TO_CANONICAL_ONBOARDING_BEAT_ID
  ];
}

export function baseOnboardingBeatId(value: OnboardingBeatId): OnboardingBeatId {
  return (
    VARIANT_TO_BASE_ONBOARDING_BEAT_ID[value as keyof typeof VARIANT_TO_BASE_ONBOARDING_BEAT_ID] ??
    value
  );
}

export const SESSION_LOG_SCREEN_ID_CANONICAL: Record<string, string | null> = {
  ...LEGACY_TO_CANONICAL_ONBOARDING_BEAT_ID,
  morning: 'MCHECK-01',
  evening: 'ECHECK-01',
  habit_create: 'HABIT-CREATE-FORK',
  feedback: null,
};

export function resolveSessionLogScreenId(value: string): string | undefined {
  const onboardingId = resolveOnboardingBeatId(value);
  if (onboardingId) return onboardingId;
  if (value in SESSION_LOG_SCREEN_ID_CANONICAL) {
    return SESSION_LOG_SCREEN_ID_CANONICAL[value] ?? undefined;
  }
  return value;
}
