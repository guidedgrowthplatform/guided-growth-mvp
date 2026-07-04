import type { OnboardingState } from '@gg/shared/types';
import type { LLMChatMessage, LLMToolEvent } from '@gg/shared/types/llm';
import type {
  OnboardingCard,
  ProfileCardData,
  ReflectionCardConfig,
  SerializedHabitConfig,
} from './onboardingChatTypes';
import { beatForStep, stepForScreenId, type BeatCardType } from './onboardingStepBeats';

const strArr = (v: unknown): string[] | undefined =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') && v.length > 0
    ? (v as string[])
    : undefined;

// Normalize persisted habit configs (days may be number[] or a leftover Set)
// into the serialized {days: number[]} shape the cards edit.
function habitConfigsFrom(v: unknown): Record<string, SerializedHabitConfig> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const out: Record<string, SerializedHabitConfig> = {};
  for (const [name, cfg] of Object.entries(v as Record<string, unknown>)) {
    if (!cfg || typeof cfg !== 'object') continue;
    const c = cfg as { days?: unknown; time?: unknown; reminder?: unknown; schedule?: unknown };
    const days = Array.isArray(c.days)
      ? (c.days.filter((d) => typeof d === 'number') as number[])
      : c.days instanceof Set
        ? Array.from(c.days as Set<number>)
        : [];
    out[name] = {
      days,
      time: typeof c.time === 'string' ? c.time : '',
      reminder: Boolean(c.reminder),
      ...(typeof c.schedule === 'string' && c.schedule.length > 0 ? { schedule: c.schedule } : {}),
    };
  }
  return Object.keys(out).length ? out : undefined;
}

function reflectionConfigFrom(v: unknown): ReflectionCardConfig | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const c = v as { time?: unknown; days?: unknown; reminder?: unknown; schedule?: unknown };
  return {
    time: typeof c.time === 'string' ? c.time : '21:45',
    days: Array.isArray(c.days) ? (c.days.filter((d) => typeof d === 'number') as number[]) : [],
    reminder: Boolean(c.reminder),
    schedule: typeof c.schedule === 'string' ? c.schedule : 'Weekday',
  };
}

// submit_profile returns the merged DB row under payload.result.data, so the
// card reflects everything captured so far — not just this turn's args.
function profileFromEvent(evt: LLMToolEvent): ProfileCardData | null {
  if (evt.name !== 'submit_profile' || !evt.result?.ok) return null;
  const payload = evt.result.payload as { result?: { data?: Record<string, unknown> } } | undefined;
  const data = payload?.result?.data;
  if (!data) return null;
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;
  const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
  return {
    nickname: str(data.nickname),
    age: num(data.age),
    gender: str(data.gender),
    referralSource: str(data.referralSource),
    confirmed: true,
  };
}

// Derive every onboarding card carried by one assistant message's tool events.
// Mirrors src/lib/chat/coachChatCards.ts — grows one deriver per future beat.
export function buildOnboardingCards(m: LLMChatMessage): OnboardingCard[] | undefined {
  const cards: OnboardingCard[] = [];
  let profile: ProfileCardData | null = null;
  for (const evt of m.toolEvents ?? []) {
    const p = profileFromEvent(evt);
    if (p) profile = p; // last successful submit_profile wins
  }
  if (profile) cards.push({ type: 'profile', data: profile });
  return cards.length ? cards : undefined;
}

// PROACTIVE path: build the current beat's card from live onboarding state so
// it renders WITH the coach opener (pre-filled), not only after a tool fires.
// Re-derived each render, so voice/typed tool-fills (which update
// onboarding_states.data) flow straight into the card.
export function buildActiveBeatCard(
  cardType: BeatCardType,
  state: OnboardingState | null,
): OnboardingCard | null {
  const data = state?.data;
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;
  const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
  switch (cardType) {
    case 'auth':
      return { type: 'auth', data: {} };
    case 'preferences':
      return { type: 'preferences', data: {} };
    case 'profile':
      return {
        type: 'profile',
        data: {
          nickname: str(data?.nickname),
          age: num(data?.age),
          gender: str(data?.gender),
          referralSource: str(data?.referralSource),
          confirmed: false,
        },
      };
    case 'pathChoice':
      return { type: 'pathChoice', data: { path: state?.path ?? undefined } };
    case 'category':
      return {
        type: 'category',
        data: { category: str(data?.category), gender: str(data?.gender) },
      };
    case 'goals':
      return { type: 'goals', data: { category: str(data?.category), goals: strArr(data?.goals) } };
    case 'habits':
      return {
        type: 'habits',
        data: { goals: strArr(data?.goals), habitConfigs: habitConfigsFrom(data?.habitConfigs) },
      };
    case 'reflection':
      return {
        type: 'reflection',
        data: {
          config: reflectionConfigFrom(data?.reflectionConfig),
          selectedPrompts: strArr(data?.customPrompts),
        },
      };
    case 'planReview':
      return { type: 'planReview', data: {} };
    default:
      return null;
  }
}

// Resolve the inline card for a beat's screen_id, seeded from live state. Used
// to attach a card to that beat's opener message so it renders INLINE at its
// turn and stays frozen in scrollback when the flow advances (mirrors the coach
// overlay's per-message cards). Returns null for chat-only beats.
export function cardForScreenId(
  screenId: string,
  state: OnboardingState | null,
): OnboardingCard | null {
  const step = stepForScreenId(screenId);
  if (step === undefined) return null;
  const beat = beatForStep(step, state?.path ?? null);
  return buildActiveBeatCard(beat.cardType, state);
}
