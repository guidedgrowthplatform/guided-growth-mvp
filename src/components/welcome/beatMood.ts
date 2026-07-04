// Background "mood" per beat, by whose turn it is. Matched to the real chat
// overlay gradients (OnboardingChatOverlay.tsx IDLE_GRADIENT / LISTENING_GRADIENT)
// so the onboarding beats and the live chat read as the same system.
//
// Blue  = the coach / AI is active (speaking).
// Yellow = the user's turn (sign-in, choices, the user speaking).
//
// Each gradient is a soft wash rising from the bottom. The top is a light tint,
// not pure white, so the white coach bubbles and the cards stay readable against
// it. Three soft stops keep the transition gentle instead of a hard color-to-
// white band.

export const COACH_BG =
  'linear-gradient(to top, rgba(19,91,236,0.72) 0%, rgba(123,164,236,0.34) 50%, rgba(216,228,248,0.82) 100%)';

export const USER_BG =
  'linear-gradient(to top, rgba(253,208,23,0.74) 0%, rgba(250,228,140,0.34) 50%, rgba(244,241,226,0.82) 100%)';
