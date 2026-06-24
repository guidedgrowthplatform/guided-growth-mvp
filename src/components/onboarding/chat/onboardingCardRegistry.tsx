import type {
  OnboardingCard,
  ReflectionCardConfig,
  SerializedHabitConfig,
} from '@/lib/onboarding/onboardingChatTypes';
import type { OnboardingPath } from '@gg/shared/types';
import { AuthSignupCard } from './AuthSignupCard';
import { CategoryPickerCard } from './CategoryPickerCard';
import { GoalsCard } from './GoalsCard';
import { HabitsCard } from './HabitsCard';
import { OnboardingReflectionCard } from './OnboardingReflectionCard';
import { PathChoiceCard } from './PathChoiceCard';
import { PlanReviewCard } from './PlanReviewCard';
import { PreferencesCard } from './PreferencesCard';
import { ProfileCard } from './ProfileCard';

export interface ProfileSubmitFields {
  nickname?: string;
  age?: number;
  gender?: string;
  referralSource?: string;
}

export interface ReflectionSubmitPayload {
  reflectionConfig: ReflectionCardConfig;
  reflectionMode?: 'prompts';
  customPrompts?: string[];
}

// Card user-actions round-trip to persistence here (the inversion onboarding
// adds over coach cards, whose edits never return to state). Each handler
// persists its step + advances the beat; only the next-card relevant ones are
// required, the rest are wired per-beat by the page.
export interface OnboardingCardApi {
  submitProfile: (fields: ProfileSubmitFields) => void;
  submitPreferences?: (mode: 'voice' | 'screen') => void;
  submitPathChoice?: (path: OnboardingPath) => void;
  submitCategory?: (category: string) => void;
  submitGoals?: (goals: string[]) => void;
  submitHabits?: (habitConfigs: Record<string, SerializedHabitConfig>) => void;
  submitReflection?: (payload: ReflectionSubmitPayload) => void;
  confirmPlan?: () => void;
  // saveStep mutation pending (form cards).
  busy?: boolean;
  // completeOnboarding pending (plan-review card).
  completing?: boolean;
}

// type → component. Generalizes CoachChatView's hardcoded if-chain so each new
// beat is one entry, not an edit to the render site.
export function OnboardingCardSlot({
  card,
  api,
}: {
  card: OnboardingCard;
  api: OnboardingCardApi;
}) {
  switch (card.type) {
    case 'profile':
      return <ProfileCard data={card.data} api={api} />;
    case 'preferences':
      return <PreferencesCard api={api} />;
    case 'auth':
      return <AuthSignupCard />;
    case 'pathChoice':
      return <PathChoiceCard data={card.data} api={api} />;
    case 'category':
      return <CategoryPickerCard data={card.data} api={api} />;
    case 'goals':
      return <GoalsCard data={card.data} api={api} />;
    case 'habits':
      return <HabitsCard data={card.data} api={api} />;
    case 'reflection':
      return <OnboardingReflectionCard data={card.data} api={api} />;
    case 'planReview':
      return <PlanReviewCard api={api} />;
    default:
      return null;
  }
}
