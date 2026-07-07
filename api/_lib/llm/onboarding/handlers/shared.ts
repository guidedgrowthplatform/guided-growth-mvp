export {
  ok,
  invalid,
  handlerError,
  getString,
  getBoolean,
  getNumber,
  getNumberArray,
  getStringArray,
} from '../../toolArgs.js';

// user_text is the raw current-turn user message, when the caller has it handy.
// Optional and currently read only by addHabit's data-integrity guard. Every
// other handler ignores it, so this is additive and does not change their behavior.
//
// user_text_window (W2-E) is a short rolling window of recent raw user turns,
// current turn first, most recent prior turns after (see [...path].ts for how
// it's built). Widens the same guard so a two-turn confirm shape ("I want to
// stop doomscrolling at night" / next turn: "yes please add it") grounds
// against the earlier turn that actually named the habit, not just the
// current turn's short reply. Optional and additive — a caller that omits it
// (or a handler that ignores it) keeps the exact current-turn-only behavior.
//
// assistant_text_window (W2-H) is the last 1-2 raw ASSISTANT (coach) turns,
// current-screen only, most recent first. It exists ONLY to resolve a distinct
// deadlock: at habit-select the coach proposes a concretely-named preset habit
// ("how about 'No screens after 10 PM'?") and the user affirms it in a bare
// reply ("yes please add it"). No USER turn ever contains the habit name, so
// looksUngroundedInWindow rejects forever and the coach re-asks in a loop
// (W2-E note on MR !484, evidence note 3908). A user's explicit affirmation of
// a concretely-named coach proposal is real consent (the user did answer,
// nothing is invented), so addHabit.ts consults this window ONLY when the
// current user turn is itself a bare affirmation — never for any other guard,
// and never to launder a name the user did not actually agree to. Kept as a
// SEPARATE field from user_text_window on purpose: mixing coach text into the
// user window would let other guards mistake coach narration for user intent.
export type OnboardingHandlerCtx = {
  anon_id: string;
  screen_id?: string;
  user_text?: string;
  user_text_window?: string[];
  assistant_text_window?: string[];
};

export const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;
// Unicode letters/marks + digits + spaces and common name punctuation.
export const NICKNAME_REGEX = /^[\p{L}\p{M}0-9 '\-_.]*$/u;
