import type { OnboardingState, OnboardingStepData } from '@gg/shared/types';

// Curated opening lines per onboarding screen (gg-spec packets). Deterministic,
// rendered as the first coach bubble so the question never drifts.
//
// Per Yair's 2026-07-07 ruling: only the profile beat (ONBOARD-01--FORM, see
// PROFILE_OPENER_* below) keeps a locked line here, since its two state-aware
// variants are functionally better than the seed copy. Six beats that used to
// carry a locked entry (ONBOARD-FORK--FORM, ONBOARD-BEGINNER-01/02/03/07,
// ONBOARD-ADVANCED) had it removed so the flow document's seed/render copy is
// the single source of truth for those beats (resolveBeatOpener.ts falls
// through to node.voice.openerText when no locked line exists here).
const ONBOARDING_OPENERS: Record<string, string> = {
  'ONBOARD-01':
    'OK, let me get to know you a little. First, what should I call you? You can type it here, or fill it in on screen.',
  'ONBOARD-01--FORM':
    'OK, let me get to know you a little. First, what should I call you? You can type it here, or fill it in on screen.',
  'ONBOARD-BEGINNER-06':
    "Here's your starting plan. Take a look, does it all look right, or want to change anything before we start?",
  'ONBOARD-ADVANCED-04':
    "Let's set up your evening reflection, I can ask you a few questions each evening, or you can free-write. Which feels better?",
  'ONBOARD-ADVANCED-05':
    "Here's what I put together from everything you shared. Want to start with this, or tweak anything first?",
  'ONBOARD-ADV-CUSTOM':
    "What would you like me to ask you each evening? Give me up to three prompts and I'll use those.",
  'ONBOARD-ADVANCED-02':
    'Here are the habits I pulled from what you shared. Take a look, keep them as they are, or want to change anything?',
};

export function getOnboardingOpener(screenId: string): string | undefined {
  return ONBOARDING_OPENERS[screenId];
}

// The profile beat MUST collect the name (advance precondition requires
// data.nickname). When the name is already known from sign-in (OAuth, or QA which
// stamps user_metadata.nickname), greet by it and ask only the two remaining things
// (age + gender). Email sign-ups arrive nameless — SignUpPage collects only
// email+password — so when nickname is absent, open by asking for it too.
const PROFILE_OPENER_SCREENS = new Set(['ONBOARD-01', 'ONBOARD-01--FORM']);
const PROFILE_OPENER_ASK_NAME =
  'Awesome — three quick things so I can tailor this to you. What should I call you? And how old are you, and what gender are you?';
const PROFILE_OPENER_KNOWN_NAME =
  'Awesome {name}, two quick things so I can tailor this to you. How old are you, and how do you identify?';

export function getOnboardingOpenerForState(
  screenId: string,
  nickname: string | null | undefined,
): string | undefined {
  const haveName = typeof nickname === 'string' && nickname.trim().length > 0;
  if (PROFILE_OPENER_SCREENS.has(screenId)) {
    return haveName ? PROFILE_OPENER_KNOWN_NAME : PROFILE_OPENER_ASK_NAME;
  }
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

// Multi-field steps only, single-field steps use tailored copy below.
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
    text: `Last time you told me ${summary}. I still need ${humanJoin(missing)}, want to fill that in?`,
    complete: false,
  };
}
