// Background "mood" per beat, by whose turn it is. Matched to the real chat
// overlay gradients (OnboardingChatOverlay.tsx IDLE_GRADIENT / LISTENING_GRADIENT)
// so the onboarding beats and the live chat read as the same system.
//
// Blue  = the coach / AI is active (speaking).
// Yellow = the user's turn (sign-in, choices, the user speaking).
//
// Each gradient is a soft glow rising from the bottom over white, so the screen
// stays light and only the lower edge carries the color.

export const COACH_BG =
  'linear-gradient(to top, rgba(19,91,236,0.7) 0%, rgba(255,255,255,0.7) 54%, rgba(255,255,255,0.7) 81%, rgba(246,246,246,0.7) 100%)';

export const USER_BG =
  'linear-gradient(to top, rgba(253,208,23,0.7) 5%, rgba(255,255,255,0.001) 68%, rgba(255,255,255,0.7) 88%, rgba(246,246,246,0.7) 100%)';
