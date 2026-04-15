/**
 * Canonical mapping of Phase 1 voice screens to their post-completion route.
 *
 * The Cartesia Line agent calls the `navigate_next` tool with a `from_screen`
 * argument when a screen's objective is done. The frontend subscribes to the
 * tool_call event and uses this map to decide where to go next so the agent
 * drives navigation without requiring a button tap (spec Section 2.5).
 *
 * The advanced (brain-dump) fork is Phase 2; for now, ONBOARD-02 always flows
 * into the beginner path. If/when advanced lands, call `nextRouteFor` with
 * the `path` argument to branch.
 */

export type VoiceScreenId =
  | 'onboard_01'
  | 'onboard_02'
  | 'onboard_03'
  | 'onboard_04'
  | 'onboard_05'
  | 'onboard_06'
  | 'onboard_07'
  | 'onboard_08'
  | 'onboard_09';

const BEGINNER_NEXT: Record<VoiceScreenId, string> = {
  onboard_01: '/onboarding/step-2',
  onboard_02: '/onboarding/step-3',
  onboard_03: '/onboarding/step-4',
  onboard_04: '/onboarding/step-5',
  onboard_05: '/onboarding/step-6',
  onboard_06: '/onboarding/step-7',
  onboard_07: '/onboarding/edit-journal',
  onboard_08: '/onboarding/step-7',
  onboard_09: '/',
};

export function nextRouteFor(
  fromScreen: string | undefined,
  path?: 'simple' | 'braindump' | string,
): string | null {
  if (!fromScreen) return null;

  if (fromScreen === 'onboard_02' && path === 'braindump') {
    return '/onboarding/advanced-input';
  }

  return BEGINNER_NEXT[fromScreen as VoiceScreenId] ?? null;
}
