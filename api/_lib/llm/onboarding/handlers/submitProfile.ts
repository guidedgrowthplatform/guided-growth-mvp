import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { AGE_MAX, AGE_MIN, GENDER_OPTIONS } from '../schemas.js';
import { getString, invalid, NICKNAME_REGEX, ok, type OnboardingHandlerCtx } from './shared.js';

const NICKNAME_MAX_LEN = 50;
const REFERRAL_MAX_LEN = 200;

function isGenderOption(v: string): boolean {
  return (GENDER_OPTIONS as readonly string[]).includes(v);
}

export async function submitProfile(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const nickname = getString(args, 'nickname')?.trim();
  const ageRaw = getString(args, 'age');
  const gender = getString(args, 'gender');
  const referralSource = getString(args, 'referral_source');

  const hasNickname = nickname !== undefined && nickname.length > 0;
  // nickname captured at auth; this beat collects age+gender — require >=1 field.
  if (
    !hasNickname &&
    ageRaw === undefined &&
    gender === undefined &&
    referralSource === undefined
  ) {
    return invalid('at least one profile field is required');
  }
  if (hasNickname) {
    if (nickname.length > NICKNAME_MAX_LEN) {
      return invalid('nickname too long');
    }
    if (!NICKNAME_REGEX.test(nickname)) {
      return invalid('nickname contains unsupported characters');
    }
  }

  let parsedAge: number | undefined;
  if (ageRaw !== undefined) {
    if (!/^\d+$/.test(ageRaw)) {
      return invalid('age must be a numeric string');
    }
    parsedAge = parseInt(ageRaw, 10);
    if (!Number.isInteger(parsedAge) || parsedAge < AGE_MIN || parsedAge > AGE_MAX) {
      return invalid(`age must be between ${AGE_MIN} and ${AGE_MAX}`);
    }
  }

  // Rule 2: an EXPLICIT gender that is null / empty / out-of-enum is a hard
  // reject; an ABSENT gender key is the legit age-first partial-save (the
  // advance gate blocks advancing without gender). getString collapses null and
  // "key absent" both to undefined, so probe the raw arg to tell them apart.
  const genderPresent = 'gender' in args;
  if (genderPresent && (gender === undefined || gender.length === 0 || !isGenderOption(gender))) {
    return invalid('gender must be Male, Female, or Other');
  }

  if (referralSource !== undefined && referralSource.length > REFERRAL_MAX_LEN) {
    return invalid('referral_source too long');
  }

  const data: Record<string, unknown> = {};
  if (hasNickname) data.nickname = nickname;
  if (parsedAge !== undefined) data.age = parsedAge;
  if (gender !== undefined) data.gender = gender;
  if (referralSource !== undefined) data.referralSource = referralSource;

  // DATA ONLY — current_step not touched on UPDATE; advance_step moves the screen.
  // INSERT seeds step-1 (this screen's own step).
  const result = await pool.query<{ data: Record<string, unknown>; current_step: number }>(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 1, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()
     RETURNING data, current_step`,
    [ctx.anon_id, JSON.stringify(data)],
  );

  const row = result.rows[0];
  const mergedData = row?.data ?? data;
  // When gender has not been captured yet (neither this call nor a prior tap),
  // signal the model so it does NOT chain advance_step before asking for gender.
  // The step-1 precondition gate requires age+gender; a premature advance is
  // rejected and turns into a repeated-clarification loop.
  const needsGender = !mergedData.gender;
  return ok({
    data: mergedData,
    current_step: row?.current_step ?? 1,
    ...(needsGender && {
      requires_gender_before_advance:
        'gender not yet captured — call submit_profile with gender (Male | Female | Other) before chaining advance_step',
    }),
  });
}
