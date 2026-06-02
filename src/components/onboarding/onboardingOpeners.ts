import type { OnboardingState, OnboardingStepData } from '@gg/shared/types';

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

export interface RevisitOpener {
  text: string;
  // All fields present → caller may offer affirm→auto-advance.
  complete: boolean;
}

interface FieldSpec {
  label: string;
  recap: (d: OnboardingStepData, state: OnboardingState) => string | null;
}

// Multi-field steps only — single-field steps use tailored copy below.
const STEP_FIELDS: Record<string, FieldSpec[]> = {
  'ONBOARD-01': onboard01Fields(),
  'ONBOARD-01--FORM': onboard01Fields(),
};

function onboard01Fields(): FieldSpec[] {
  return [
    { label: 'your name', recap: (d) => (d.nickname ? `your name's ${d.nickname}` : null) },
    { label: 'your age', recap: (d) => (d.age ? `you're ${d.age}` : null) },
    { label: 'how you identify', recap: (d) => (d.gender ? `${d.gender}` : null) },
    {
      label: 'how you found us',
      recap: (d) => (d.referralSource ? `found us via ${d.referralSource}` : null),
    },
  ];
}

function humanJoin(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

// null → nothing known yet, caller falls back to the first-visit opener.
export function getOnboardingRevisitOpener(
  screenId: string,
  state: OnboardingState | null,
): RevisitOpener | null {
  if (!state) return null;
  const d = state.data ?? {};

  // Single-field steps: tailored copy, always complete (all-or-nothing).
  switch (screenId) {
    case 'ONBOARD-FORK':
    case 'ONBOARD-FORK--FORM': {
      if (!state.path) return null;
      const choice = state.path === 'braindump' ? 'advanced' : 'beginner';
      return {
        text: `You picked the ${choice} path. Want to keep it and move on, or switch?`,
        complete: true,
      };
    }
    case 'ONBOARD-BEGINNER-01': {
      if (!d.category) return null;
      return {
        text: `You chose ${d.category}. Want to stick with that and move on, or pick another?`,
        complete: true,
      };
    }
  }

  const specs = STEP_FIELDS[screenId];
  if (!specs) return null;

  const filled: string[] = [];
  const missing: string[] = [];
  for (const f of specs) {
    const frag = f.recap(d, state);
    if (frag) filled.push(frag);
    else missing.push(f.label);
  }
  if (filled.length === 0) return null;

  const summary = humanJoin(filled);
  if (missing.length === 0) {
    return {
      text: `Last time you told me ${summary}. Want to keep that and move on, or change something?`,
      complete: true,
    };
  }
  return {
    text: `Last time you told me ${summary}. I still need ${humanJoin(missing)} — want to fill that in?`,
    complete: false,
  };
}
