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
export type OnboardingHandlerCtx = {
  anon_id: string;
  screen_id?: string;
  user_text?: string;
  user_text_window?: string[];
};

export const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;
// Unicode letters/marks + digits + spaces and common name punctuation.
export const NICKNAME_REGEX = /^[\p{L}\p{M}0-9 '\-_.]*$/u;
