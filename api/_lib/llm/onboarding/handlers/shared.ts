export {
  ok,
  invalid,
  handlerError,
  getString,
  getBoolean,
  getNumberArray,
  getStringArray,
} from '../../toolArgs.js';

export type OnboardingHandlerCtx = { anon_id: string; screen_id?: string };

export const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;
// Unicode letters/marks + digits + spaces and common name punctuation.
export const NICKNAME_REGEX = /^[\p{L}\p{M}0-9 '\-_.]*$/u;
