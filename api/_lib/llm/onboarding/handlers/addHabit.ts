import type { HabitType } from '@gg/shared/types';
import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { inferSchedule, SCHEDULE_DAYS, type ScheduleOption } from '../../tools.onboarding.js';
import { MAX_HABITS, MAX_HABITS_ADVANCED, SCHEDULE_OPTIONS } from '../schemas.js';
import {
  getBoolean,
  getNumberArray,
  getString,
  handlerError,
  invalid,
  ok,
  TIME_REGEX,
  type OnboardingHandlerCtx,
} from './shared.js';

const NAME_MAX_LEN = 100;
const DEFAULT_TIME = '09:00';

function isScheduleOption(v: string): boolean {
  return (SCHEDULE_OPTIONS as readonly string[]).includes(v);
}

// Data-integrity guard (B54): a new habit's name should trace to something the
// user actually said this turn, not a nearby preset the model picked on its
// own (rambler trail F3: "phone on the charger" saved as "No screens after 10
// PM") and not a name invented from a passing word (rambler-advanced trail F4:
// a clarifying question about "sleep" produced a fabricated Sleep habit).
//
// This is a coarse, low-false-positive check on purpose: word-level overlap,
// not semantic matching. It only runs when the caller actually has the raw
// turn text (ctx.user_text) and only on a brand-new habit name (isEdit
// short-circuits it upstream). Schedule-only follow-up calls in the two-call
// configure pattern don't restate the name, so they're never checked here.
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'to',
  'of',
  'in',
  'on',
  'at',
  'for',
  'with',
  'my',
  'me',
  'i',
  'is',
  'am',
  'are',
  'be',
  'do',
  'no',
  'not',
  'every',
  'each',
  'day',
  'days',
  'per',
  'week',
  'about',
  'just',
  'this',
  'that',
  'it',
  // B60: "more" alone doesn't identify a topic — without this, "walk more"
  // and "work more" (or any other "X more" pair) share only this token and
  // would falsely ground against each other. See isExplicitCorrection below
  // for the bug this closes.
  'more',
]);

function meaningfulTokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

// True when the habit name shares no meaningful token with the user's turn,
// meaning it looks like a substitution or a fabrication rather than a
// paraphrase of what they said. Names too short to tokenize meaningfully
// (e.g. "Gym") never trip this, the check needs at least one real token to compare.
export function looksUngrounded(name: string, userText: string): boolean {
  const nameTokens = meaningfulTokens(name);
  if (nameTokens.length === 0) return false;
  const textTokens = new Set(meaningfulTokens(userText));
  if (textTokens.size === 0) return false;
  return !nameTokens.some((t) => textTokens.has(t));
}

// W2-E: confirm-turn grounding window. A two-turn shape (turn 1: "I want to
// stop doomscrolling at night", turn 2: "yes please add it") trips
// looksUngrounded when checked against only the current turn's short reply,
// even though the name genuinely grounds in the turn just before it. Passes
// when the name grounds in ANY entry of the window (current turn plus a few
// recent prior turns); rejects only when it grounds in none of them. Blank
// entries are dropped first — looksUngrounded('', ...) always passes (no
// tokens to compare), which would otherwise let one blank entry launder the
// whole window regardless of what the other entries say.
export function looksUngroundedInWindow(name: string, userTextWindow: string[]): boolean {
  const texts = userTextWindow.filter((t) => t.trim().length > 0);
  if (texts.length === 0) return false;
  return texts.every((text) => looksUngrounded(name, text));
}

// W2-H: affirmed-coach-proposal deadlock. At habit-select the coach often
// proposes a concretely-named PRESET habit ("how about 'No screens after 10
// PM'?") and the user's whole reply is a bare "yes" / "yes please add it".
// No user turn in the window ever contains the habit name (the user never
// said it, the coach did), so looksUngroundedInWindow rejects every attempt
// and the coach re-asks forever (MR !484 evidence note 3908). A bare
// affirmation of a concretely-named proposal is real consent under DATA
// INTEGRITY law 1 (the user did answer; nothing is invented), so this pattern
// is deliberately conservative: it only matches short, unambiguous "yes"-shaped
// replies, never a sentence that also carries its own content (that content
// should ground the name on its own merits via the normal checks above).
const BARE_AFFIRMATION_RE =
  /^(yes|yeah|yep|yup|sure|ok(?:ay)?|sounds good|that (?:one|works)|do it|add it)([,.!]?\s*please)?[.!]?$/i;
const AFFIRMATION_WITH_ADD_RE =
  /^((yes|yeah|yep|yup|sure|ok(?:ay)?)[,.]?\s+(please\s+)?|go ahead(?:\s+and)?\s+)(add|do)(?:\s+(?:it|that one|the first one|the second one))?[.!]?$/i;

export function isBareAffirmation(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return false;
  return BARE_AFFIRMATION_RE.test(t) || AFFIRMATION_WITH_ADD_RE.test(t);
}

// True when the name grounds in at least one entry of the coach's own recent
// turns. Same lexical overlap primitive as looksUngrounded, just checked
// against what the COACH said rather than what the user said — this is only
// ever safe to consult when the current user turn is itself a bare
// affirmation (isBareAffirmation), which the caller in addHabit() enforces.
export function groundsInAssistantWindow(name: string, assistantTextWindow: string[]): boolean {
  const texts = assistantTextWindow.filter((t) => t.trim().length > 0);
  if (texts.length === 0) return false;
  return texts.some((text) => !looksUngrounded(name, text));
}

// B59: user-content precedence. The W2-H escape hatch above lets a bare
// "yes" ground the coach's OWN proposed name, for the real deadlock where the
// user never said anything of their own. But if the user's window ALSO
// carries real content they stated themselves (not just an affirmation), the
// escape hatch must not fire: the user's words outrank a coach proposal.
// Reproduces a real trail: the user said "stop doomscrolling" a couple of
// turns earlier, then gave an ambiguous "yes", and the coach saved its own
// suggested "Same bedtime" preset instead of the user's own habit. A turn
// counts as the user's own content when it is not itself a bare affirmation
// and it tokenizes to at least one meaningful word — a blank turn or another
// "yes" does not count, so the true deadlock (the user only ever affirmed)
// still reaches the escape hatch below.
function hasOwnUserContent(userTextWindow: string[]): boolean {
  return userTextWindow.some(
    (text) =>
      text.trim().length > 0 && !isBareAffirmation(text) && meaningfulTokens(text).length > 0,
  );
}

// B60: correction-language detector. Deliberately narrow — a word-boundary
// match on "i said" / "i meant" — to keep the false-positive rate low, the
// same design choice BARE_AFFIRMATION_RE makes above. Coach-integrity bug
// (2026-07-07 tester report): STT misheard "work more" as "walk more", the
// coach built the next question on the wrong reading, and the user
// corrected it plainly ("I said work more, but."). The coach argued for its
// own prior reading instead of accepting the correction. See the
// currentTurnIsCorrection gate in addHabit() below for the mechanical half
// of the fix; systemPromptAddendum.ts DATA INTEGRITY rule 6 is the other
// half (governs the coach's actual reply text, which no unit test reaches).
const EXPLICIT_CORRECTION_RE = /\b(i said|i meant)\b/i;

export function isExplicitCorrection(text: string): boolean {
  return EXPLICIT_CORRECTION_RE.test(text);
}

export async function addHabit(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const name = getString(args, 'name');
  if (name === undefined || name.length === 0) return invalid('name is required');
  if (name.length > NAME_MAX_LEN) {
    return invalid(`name must be at most ${NAME_MAX_LEN} characters`);
  }

  // name-only parity with Vapi: every other field is optional and defaulted.
  const daysRaw = getNumberArray(args, 'days');
  const daysValid =
    daysRaw !== undefined &&
    daysRaw.length > 0 &&
    daysRaw.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  const scheduleRaw = getString(args, 'schedule');
  const scheduleProvided = scheduleRaw !== undefined && isScheduleOption(scheduleRaw);

  // days authoritative; reconcile schedule from days, else expand preset, else Weekday.
  let days: number[];
  let schedule: ScheduleOption;
  if (daysValid) {
    days = Array.from(new Set(daysRaw as number[])).sort((a, b) => a - b);
    schedule =
      inferSchedule(days) ?? (scheduleProvided ? (scheduleRaw as ScheduleOption) : 'Weekday');
  } else if (scheduleProvided) {
    schedule = scheduleRaw as ScheduleOption;
    days = [...SCHEDULE_DAYS[schedule]];
  } else {
    schedule = 'Weekday';
    days = [...SCHEDULE_DAYS.Weekday];
  }

  const timeRaw = getString(args, 'time');
  const time = timeRaw !== undefined && TIME_REGEX.test(timeRaw) ? timeRaw : DEFAULT_TIME;

  const reminder = getBoolean(args, 'reminder') ?? true;

  const habitTypeRaw = getString(args, 'habit_type');
  const habitTypeArg =
    habitTypeRaw === 'binary_avoid' || habitTypeRaw === 'binary_do' ? habitTypeRaw : undefined;
  const nameLower = name.toLowerCase();

  // Advisory lock so read+cap-check+write is atomic — concurrent calls can't
  // both pass the cap gate. pool is max:1; pool.query can't span a txn.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [ctx.anon_id]);

    // path drives the cap (ledger ruling B37: "there is no limit in advanced").
    // 'braindump' = advanced. Missing path defaults to beginner (the stricter
    // cap), so a legacy row without a path can never over-count.
    const existingRes = await client.query<{
      hc: Record<string, unknown> | null;
      path: string | null;
    }>(`SELECT data->'habitConfigs' AS hc, path FROM onboarding_states WHERE anon_id = $1`, [
      ctx.anon_id,
    ]);
    const existing = (existingRes.rows[0]?.hc ?? {}) as Record<string, unknown>;
    const isAdvanced = existingRes.rows[0]?.path === 'braindump';
    const cap = isAdvanced ? MAX_HABITS_ADVANCED : MAX_HABITS;
    const isEdit = Object.keys(existing).some((k) => k.toLowerCase() === nameLower);

    // B54 data-integrity guard: only on a brand-new habit, and only when the
    // caller supplied the raw turn text. Ungrounded means the name shares no
    // real word with what the user said this turn, so reject and force the
    // coach to either ask again or save the user's own words instead of a
    // guessed/substituted name (see systemPromptAddendum.ts DATA INTEGRITY).
    //
    // W2-E: when the caller supplies user_text_window (a rolling window of
    // recent user turns, current turn first), check the WHOLE window instead
    // of just the current turn — a two-turn confirm shape ("...doomscrolling
    // at night" then next turn "yes please add it") grounds in the earlier
    // turn, not the short confirm reply itself. Window absent falls back to
    // the exact current-turn-only check (backward compatible).
    const userTextWindow: string[] =
      ctx.user_text_window && ctx.user_text_window.length > 0
        ? ctx.user_text_window
        : ctx.user_text
          ? [ctx.user_text]
          : [];
    const currentTurnText = userTextWindow[0];

    // B60: explicit user correction precedence. looksUngroundedInWindow
    // grounds a name against ANY entry in the window (an OR across turns),
    // which is right for the W2-E confirm-turn shape but wrong here: when
    // the current turn explicitly corrects a prior misreading ("I said work
    // more, but."), an earlier window entry can be the very thing being
    // corrected away from (the coach's own mis-transcribed "walk more"
    // turn), and letting it still vouch for the old name defeats the
    // correction. When the current turn is an explicit correction that
    // carries real content of its own, it alone grounds the name — the
    // stale entry does not get a vote. A correction turn with no real
    // content beyond the correction phrase itself (hasOwnUserContent false)
    // falls through to the ordinary whole-window check below.
    const currentTurnIsCorrection =
      Boolean(currentTurnText) &&
      isExplicitCorrection(currentTurnText as string) &&
      hasOwnUserContent([currentTurnText as string]);
    const ungrounded = currentTurnIsCorrection
      ? looksUngrounded(name, currentTurnText as string)
      : looksUngroundedInWindow(name, userTextWindow);

    // W2-H: affirmed-coach-proposal escape hatch. Only consulted when the
    // user-window check above rejected AND the current turn is a bare
    // affirmation ("yes", "yes please add it", ...) — never for a refusal, a
    // clarifying question, or any turn that carries its own content (that
    // content must ground the name on its own via the checks above). Accepts
    // when the coach's own recent turn(s) actually named this habit, i.e. the
    // user is affirming something concrete the coach just proposed, not
    // rubber-stamping a fabrication. See shared.ts's OnboardingHandlerCtx doc
    // and MR !484 evidence note 3908 for the deadlock this resolves.
    //
    // B59: user content outranks a coach proposal. The escape hatch above
    // only exists for the true deadlock, where the user never stated any
    // habit of their own and just affirmed what the coach named. If the
    // window ALSO carries real content the user stated themselves, that
    // content wins: the coach must save the user's own words, not substitute
    // its suggestion, so hasOwnUserContent gates the escape hatch closed.
    const affirmedCoachProposal =
      ungrounded &&
      Boolean(currentTurnText) &&
      isBareAffirmation(currentTurnText as string) &&
      !hasOwnUserContent(userTextWindow) &&
      Boolean(ctx.assistant_text_window) &&
      groundsInAssistantWindow(name, ctx.assistant_text_window as string[]);

    if (!isEdit && ungrounded && !affirmedCoachProposal) {
      await client.query('ROLLBACK');
      return handlerError('habit_name_ungrounded');
    }

    if (!isEdit && Object.keys(existing).length >= cap) {
      await client.query('ROLLBACK');
      // Beginner: the product cap of 2. Advanced: only the safety ceiling, which
      // no real user reaches — surface a distinct code so the coach SAYS it and
      // never silently drops the habit (ruling B37).
      return handlerError(isAdvanced ? 'max_habits_capacity' : 'max_habits_reached');
    }

    // Polarity: provided value wins; else preserve what an earlier add_habit call
    // staged — the per-name merge would otherwise drop it on the schedule call.
    const priorEntry = Object.entries(existing).find(
      ([k]) => k.toLowerCase() === nameLower,
    )?.[1] as { habitType?: HabitType } | undefined;
    const habitType = habitTypeArg ?? priorEntry?.habitType;
    const habitEntry = habitType
      ? { days, time, reminder, schedule, habitType }
      : { days, time, reminder, schedule };
    const insertPayload = JSON.stringify({ habitConfigs: { [name]: habitEntry } });
    const updatePayload = JSON.stringify({ [name]: habitEntry });

    const result = await client.query<{ data: Record<string, unknown>; current_step: number }>(
      `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
       VALUES ($1, 5, 'in_progress', $2::jsonb, now())
       ON CONFLICT (anon_id) DO UPDATE SET
         status = 'in_progress',
         data = jsonb_set(
           COALESCE(onboarding_states.data, '{}'::jsonb),
           '{habitConfigs}',
           COALESCE(onboarding_states.data->'habitConfigs', '{}'::jsonb) || $3::jsonb
         ),
         updated_at = now()
       RETURNING data, current_step`,
      [ctx.anon_id, insertPayload, updatePayload],
    );
    await client.query('COMMIT');

    const row = result.rows[0];
    return ok({
      data: row?.data ?? { habitConfigs: { [name]: habitEntry } },
      current_step: row?.current_step ?? 5,
      habit: { name, ...habitEntry },
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // rollback best-effort
    }
    throw err;
  } finally {
    client.release();
  }
}
