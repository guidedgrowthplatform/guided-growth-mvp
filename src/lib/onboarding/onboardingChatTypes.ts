// Inline onboarding cards rendered under a coach bubble (chat-native onboarding).
// Kept separate from coachChatTypes — onboarding cards round-trip a user
// confirm back to persistence, which coach cards never do.

import type { OnboardingPath } from '@gg/shared/types';

export interface ProfileCardData {
  nickname?: string;
  age?: number;
  gender?: string;
  referralSource?: string;
  // true once submit_profile succeeded for the shown values.
  confirmed: boolean;
}

// Beat 0 — how the user wants to interact. Persisted into user preferences,
// not onboarding_states, so the card carries no seed data.
export type PreferencesCardData = Record<string, never>;

// Beat 0 (chat-native) — auth visual shell. Real auth wiring lands later;
// today the buttons just advance the beat.
export type AuthCardData = Record<string, never>;

// Serialized habit config (days as number[], matching onboarding_states.data).
export interface SerializedHabitConfig {
  days: number[];
  time: string;
  reminder: boolean;
  schedule?: string;
}

export interface ReflectionCardConfig {
  time: string;
  days: number[];
  reminder: boolean;
  schedule: string;
}

export type OnboardingCard =
  | { type: 'profile'; data: ProfileCardData }
  | { type: 'preferences'; data: PreferencesCardData }
  | { type: 'auth'; data: AuthCardData }
  | { type: 'pathChoice'; data: { path?: OnboardingPath } }
  | { type: 'category'; data: { category?: string; gender?: string } }
  | { type: 'goals'; data: { category?: string; goals?: string[] } }
  | {
      type: 'habits';
      data: { goals?: string[]; habitConfigs?: Record<string, SerializedHabitConfig> };
    }
  | { type: 'reflection'; data: { config?: ReflectionCardConfig; selectedPrompts?: string[] } }
  // Display-only — reads live plan from onboarding state inside the component.
  | { type: 'planReview'; data: Record<string, never> };
