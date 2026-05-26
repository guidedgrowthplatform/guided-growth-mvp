import type { OnboardingState } from '@shared/types';

// Curated opening lines per onboarding screen (gg-spec packets). Deterministic —
// rendered as the first coach bubble so the question never drifts.
export const ONBOARDING_OPENERS: Record<string, string> = {
  'ONBOARD-01':
    'OK, let me get to know you a little. First — what should I call you? You can type it here, or fill it in on screen.',
  'ONBOARD-01--FORM':
    'OK, let me get to know you a little. First — what should I call you? You can type it here, or fill it in on screen.',
  'ONBOARD-FORK':
    'Quick question — have you tracked habits before, or is this new for you? Either way is great. I just want to know the best way to guide you.',
  'ONBOARD-FORK--FORM':
    'Quick question — have you tracked habits before, or is this new for you? Either way is great. I just want to know the best way to guide you.',
  'ONBOARD-BEGINNER-01':
    "So — what feels most worth improving right now? Don't overthink it. There's no wrong answer. Pick the one that pulls you. You can always add more later.",
  'ONBOARD-BEGINNER-02':
    "OK — within that, what's the specific thing you want to work on? Pick the one that hits hardest.",
  'ONBOARD-BEGINNER-03':
    "Here are a few habits that really help with this. Pick what feels doable. Not heroic. Not impressive. Doable. Because one habit done consistently beats five that don't stick. You can also create your own if none of these fit.",
  'ONBOARD-ADVANCED':
    "Tell me everything you want to achieve — say or type as much as you want, and I'll organize it into habits for you.",
};

export function getOnboardingOpener(screenId: string): string | undefined {
  return ONBOARDING_OPENERS[screenId];
}

// Deterministic summary + "move on?" prompt, only when the screen's required
// fields are already present. undefined → caller falls back to first-visit opener.
export function getOnboardingRevisitOpener(
  screenId: string,
  state: OnboardingState | null,
): string | undefined {
  if (!state) return undefined;
  const d = state.data ?? {};
  switch (screenId) {
    case 'ONBOARD-01':
    case 'ONBOARD-01--FORM': {
      if (!d.nickname || !d.age || !d.gender || !d.referralSource) return undefined;
      return `Last time you told me your name's ${d.nickname}, you're ${d.age}, ${d.gender}, and found us via ${d.referralSource}. Want to keep that and move on, or change something?`;
    }
    case 'ONBOARD-FORK':
    case 'ONBOARD-FORK--FORM': {
      if (!state.path) return undefined;
      const choice = state.path === 'braindump' ? 'advanced' : 'beginner';
      return `You picked the ${choice} path. Want to keep it and move on, or switch?`;
    }
    case 'ONBOARD-BEGINNER-01': {
      if (!d.category) return undefined;
      return `You chose ${d.category}. Want to stick with that and move on, or pick another?`;
    }
    default:
      return undefined;
  }
}
