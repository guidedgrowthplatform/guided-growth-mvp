// Server-side guard (B58) for the setup-config tools: submit_morning_checkin,
// submit_reflection_config, submit_weekly_config. Same pattern as addHabit's
// B54 habit_name_ungrounded guard: the prompt-only DATA INTEGRITY law (rule 4
// in systemPromptAddendum.ts) does not stop the model from calling the save
// tool in the same turn as an explicit refusal — proven twice live (see
// gg-spec/tools/convo-harness reports/b54-morning-refusal-proof.md, FAIL
// 14/15, and the resister round-2 trail turn 12: "I don't want to do a
// morning thing at all. Just the evening one." still produced
// submit_morning_checkin with default config, ok:true, persisted).
//
// Two independent legs, either one can reject the call:
//
// 1. REFUSAL REJECTION: the current turn explicitly declines the thing this
//    tool configures. Deliberately conservative — explicit negation of THIS
//    surface, not general grumpiness or a skip of something else. Ambiguous
//    text passes (allow, don't block).
//
// 2. GROUNDING: the current turn carries no configuration content at all for
//    this tool (no time-of-day, no day-of-week word, no affirmation of a
//    coach proposal). Catches the same "silent default save" shape as the
//    refusal case but without an explicit no — e.g. an off-topic reply or a
//    clarifying question landing on this beat.
//
// Grounding is intentionally permissive on affirmations: the server cannot
// see the coach's prior turn, so it cannot tell "yes" apart from "yes to the
// specific config you just proposed" from "yes" in the abstract. A bare
// affirmative ("yes please", "sounds good", "sure", "that works") always
// counts as grounded here. This means leg 2 alone cannot catch a case where
// the model asks nothing and just says "yes" to itself — leg 1 (the explicit
// refusal case, which is the proven, reproducible bug) is the one doing the
// real work. Documented asymmetry, not an oversight.
//
// Both legs are skipped entirely when user_text is absent or empty (same
// backward-compatible convention as looksUngrounded in addHabit.ts).

export type SetupConfigGuardResult =
  | { blocked: false }
  | { blocked: true; code: 'config_refused_by_user' | 'config_not_grounded' };

// Nouns/phrases this surface is known by in ordinary conversation. Used to
// scope leg 1 (refusal) to THIS surface's own topic, not a refusal of
// something else the user is separately declining. Kept short and literal on
// purpose — a longer list would drift toward matching general complaints.
export type SetupSurface = {
  /** e.g. ['morning check-in', 'morning thing', 'morning'] */
  nouns: string[];
};

const AFFIRMATION_RE =
  /\b(yes|yeah|yep|yup|sure|sounds good|works for me|that works|ok(?:ay)?|perfect|great|let'?s do (?:it|that)|go for it|do it)\b/i;

// Explicit negation words/phrases. Deliberately narrow: "don't/doesn't want",
// "no [surface]", "not interested", "skip", "never mind" + a surface noun
// nearby, "just the X" (an implicit refusal of the OTHER options by naming
// only one) is handled separately below since it doesn't pair with a negation
// word directly.
const NEGATION_RE =
  /\b(don'?t want|do not want|no thanks|not interested|not doing|skip|never ?mind|nah|not really|rather not|don'?t need|do not need)\b/i;

// "just the evening one" / "only the evening reflection" style: names ONE
// alternative explicitly, which is an implicit refusal of every OTHER
// surface in the same family (morning check-in / evening reflection / weekly
// review) when the current tool is not the one named. Conservative on
// purpose: only fires when a DIFFERENT known surface noun is named via
// "just"/"only", not a bare mention.
const JUST_ONLY_RE = /\b(just|only)\b/i;

export const SURFACES: Record<'morning' | 'reflection' | 'weekly', SetupSurface> = {
  morning: {
    nouns: ['morning check-in', 'morning check in', 'morning thing', 'morning reminder', 'morning'],
  },
  reflection: {
    nouns: [
      'evening reflection',
      'evening check-in',
      'evening check in',
      'daily reflection',
      'reflection',
      'evening',
    ],
  },
  weekly: {
    nouns: ['weekly review', 'the weekly', 'weekly check-in', 'weekly'],
  },
};

const ALL_SURFACE_NOUNS: string[] = Object.values(SURFACES).flatMap((s) => s.nouns);

function otherSurfaceNouns(surface: SetupSurface): string[] {
  return Object.values(SURFACES)
    .filter((s) => s !== surface)
    .flatMap((s) => s.nouns);
}

function hasNegationOfSurface(text: string, surface: SetupSurface): boolean {
  if (!NEGATION_RE.test(text)) return false;
  // Negation word present. Require it to be talking about THIS surface: either
  // a surface noun appears anywhere in the same turn (the common case, e.g.
  // "I don't want to do a morning thing at all"), or the negation has no
  // surface noun at all but also names no OTHER surface (a bare "no thanks" /
  // "skip that" right after the coach's own proposal for this beat is still a
  // refusal of what's being asked right now).
  const mentionsThisSurface = surface.nouns.some((n) => text.includes(n));
  if (mentionsThisSurface) return true;
  const mentionsAnySurface = ALL_SURFACE_NOUNS.some((n) => text.includes(n));
  return !mentionsAnySurface;
}

function hasJustOnlyOtherSurface(text: string, surface: SetupSurface): boolean {
  if (!JUST_ONLY_RE.test(text)) return false;
  const namesThisSurface = surface.nouns.some((n) => text.includes(n));
  if (namesThisSurface) return false; // "just the morning one" affirms THIS surface
  return otherSurfaceNouns(surface).some((n) => text.includes(n));
}

// Day-of-week / time-of-day tokens that count as real configuration content
// for leg 2's grounding check. Deliberately loose (any weekday name, "every
// day", a HH:MM or "9am"/"9 pm" shaped time, "morning"/"evening"/"weekend")
// since leg 2 only needs to tell "the turn said something config-shaped" from
// "the turn said nothing config-shaped", not validate the value — the
// handler's own field validation does that.
const CONFIG_CONTENT_RE =
  /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|every ?day|weekday|weekend|\d{1,2}(:\d{2})?\s?(am|pm)|\d{1,2}:\d{2})\b/i;

function hasConfigContent(text: string): boolean {
  return CONFIG_CONTENT_RE.test(text);
}

function isAffirmation(text: string): boolean {
  return AFFIRMATION_RE.test(text);
}

/**
 * Checks the current turn's raw text against one setup-config surface
 * (morning check-in / evening reflection / weekly review). Returns
 * `{ blocked: false }` when userText is absent/empty (guard disabled, same
 * convention as addHabit's looksUngrounded) or when neither leg trips.
 */
export function checkSetupConfigGuard(
  surface: SetupSurface,
  userText: string | undefined,
): SetupConfigGuardResult {
  if (!userText) return { blocked: false };
  const text = userText.toLowerCase();

  // Leg 1: explicit refusal of this surface.
  if (hasNegationOfSurface(text, surface) || hasJustOnlyOtherSurface(text, surface)) {
    return { blocked: true, code: 'config_refused_by_user' };
  }

  // Leg 2: no configuration content and no affirmation of a coach proposal.
  // Affirmations pass permissively (see module doc) — the server cannot see
  // the coach's prior turn, so a bare "yes please" is treated as grounded.
  if (!hasConfigContent(text) && !isAffirmation(text)) {
    return { blocked: true, code: 'config_not_grounded' };
  }

  return { blocked: false };
}
