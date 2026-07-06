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
// Optional and currently read only by addHabit's data-integrity guard — every
// other handler ignores it, so this is additive and does not change their behavior.
export type OnboardingHandlerCtx = { anon_id: string; screen_id?: string; user_text?: string };

export const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;
// Unicode letters/marks + digits + spaces and common name punctuation.
export const NICKNAME_REGEX = /^[\p{L}\p{M}0-9 '\-_.]*$/u;
