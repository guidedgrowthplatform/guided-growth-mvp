// GENERATED from the onboarding contract. DO NOT EDIT.
// contractRevision: phaseb-fixture-v1

export const BEAT_IDS = [
  "welcome",
  "welcome-women",
  "profile",
  "path",
  "category",
  "finish"
] as const;
export type BeatId = (typeof BEAT_IDS)[number];

export const LEGACY_SCREEN_ID_TO_BEAT_ID: Readonly<Record<string, BeatId>> = {
  "ONBOARD-WELCOME": "welcome",
  "ONBOARD-01--FORM": "profile",
  "ONBOARD-FORK": "path",
  "ONBOARD-BEGINNER-01": "category",
  "ONBOARD-INTO-APP": "finish"
};
export const BEAT_ID_TO_LEGACY_SCREEN_IDS: Readonly<Record<BeatId, readonly string[]>> = {
  "welcome": [
    "ONBOARD-WELCOME"
  ],
  "welcome-women": [
    "ONBOARD-WELCOME"
  ],
  "profile": [
    "ONBOARD-01--FORM"
  ],
  "path": [
    "ONBOARD-FORK"
  ],
  "category": [
    "ONBOARD-BEGINNER-01"
  ],
  "finish": [
    "ONBOARD-INTO-APP"
  ]
};

export const VAPI_BEAT_IDS: ReadonlySet<BeatId> = new Set([
  "profile"
]);
export const MP3_BEAT_IDS: ReadonlySet<BeatId> = new Set([
  "welcome",
  "welcome-women"
]);
export const HYBRID_BEAT_IDS: ReadonlySet<BeatId> = new Set([
  "path"
]);

export function beatIdForLegacyScreenId(screenId: string): BeatId | undefined {
  return LEGACY_SCREEN_ID_TO_BEAT_ID[screenId];
}
