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

  // Optional fields: a malformed OPTIONAL must NOT discard the whole save (that
  // would drop a valid nickname + any other good fields). Skip the bad one, save
  // the rest, and tell the coach what to re-ask via `notes`. Garbled speech
  // ("twenty-six", "in sixth") yields a non-numeric age — common, not fatal.
  const notes: string[] = [];

  let parsedAge: number | undefined;
  const ageTrimmed = ageRaw?.trim();
  if (ageTrimmed) {
    if (!/^\d+$/.test(ageTrimmed)) {
      notes.push(
        `age "${ageRaw}" is not a number — ask the user their age and call submit_profile again`,
      );
    } else {
      const n = parseInt(ageTrimmed, 10);
      if (!Number.isInteger(n) || n < AGE_MIN || n > AGE_MAX) {
        notes.push(`age ${n} is out of range (${AGE_MIN}-${AGE_MAX}) — re-confirm the user's age`);
      } else {
        parsedAge = n;
      }
    }
  }

  let validGender: string | undefined;
  if (gender !== undefined && gender.trim().length > 0) {
    if (isGenderOption(gender)) {
      validGender = gender;
    } else {
      notes.push(`gender "${gender}" is not Male/Female/Other — ask the user to pick one`);
    }
  }

  let validReferral: string | undefined;
  if (referralSource !== undefined && referralSource.trim().length > 0) {
    if (referralSource.length > REFERRAL_MAX_LEN) {
      notes.push('referral_source too long — skipped');
    } else {
      validReferral = referralSource;
    }
  }

  const data: Record<string, unknown> = { nickname };
  if (parsedAge !== undefined) data.age = parsedAge;
  if (validGender !== undefined) data.gender = validGender;
  if (validReferral !== undefined) data.referralSource = validReferral;

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
  return ok({
    data: row?.data ?? data,
    current_step: row?.current_step ?? 1,
    ...(notes.length > 0 ? { notes } : {}),
  });
}
