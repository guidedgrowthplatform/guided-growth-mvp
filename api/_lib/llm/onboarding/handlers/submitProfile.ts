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

  if (nickname === undefined || nickname.length === 0) {
    return invalid('nickname is required');
  }
  if (nickname.length > NICKNAME_MAX_LEN) {
    return invalid('nickname too long');
  }
  if (!NICKNAME_REGEX.test(nickname)) {
    return invalid('nickname contains unsupported characters');
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

  if (gender !== undefined && !isGenderOption(gender)) {
    return invalid('gender must be Male, Female, or Other');
  }

  if (referralSource !== undefined && referralSource.length > REFERRAL_MAX_LEN) {
    return invalid('referral_source too long');
  }

  const data: Record<string, unknown> = { nickname };
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
  return ok({ data: row?.data ?? data, current_step: row?.current_step ?? 1 });
}
