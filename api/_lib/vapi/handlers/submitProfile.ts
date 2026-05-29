/**
 * submit_profile handler — writes ONBOARD-01--FORM profile fields to onboarding_states.
 *
 * Auth model (see CLAUDE.md "RLS Policies Are NOT Functional" + Vapi auth notes):
 * - Channel auth is the shared `X-Vapi-Secret` header, verified before this fn runs.
 * - Identity (`anon_id`) arrives in the tool args, injected by Vapi from the call's
 *   static parameter mapping `[{key:"anon_id", value:"{{anon_id}}"}]`. We trust the
 *   value but defensively validate UUID format — Vapi guarantees override of any
 *   LLM-supplied collision.
 *
 * Validation mirrors ONBOARDING_TOOLS schema + the rules in api/_lib/llm/tools.ts
 * (NICKNAME_REGEX, PROFILE_FIELD_MAX_LEN). Drift here means voice writes a different
 * shape than the manual form — keep aligned.
 *
 * Data shape: camelCase to match onboarding_states.data shape produced by
 * api/onboarding/[...path].ts (referral_source → referralSource).
 */
import pool from '../../db.js';
import { GENDER_OPTIONS } from '../../llm/tools.onboarding.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NICKNAME_REGEX = /^[a-zA-Z0-9_]*$/;
const NICKNAME_MAX_LEN = 50;
const REFERRAL_MAX_LEN = 200;
const AGE_MIN = 13;
const AGE_MAX = 120;

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

// GPT-family models drift off `type: 'string'` schemas for numeric values
// (Step1Page.tsx:51 documents the same drift on the direct-LLM path). Accept
// either string or number and normalize to string.
function getStringOrNumberAsString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

function isGenderOption(v: string): boolean {
  return (GENDER_OPTIONS as readonly string[]).includes(v);
}

export async function submitProfile(args: Record<string, unknown>): Promise<HandlerResult> {
  // 1. Identity — required, UUID format. Vapi injects this from the call's static params.
  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  // 2. LLM-provided fields. All optional at the handler level so edit-mode
  // updates work (user changing only their age after nickname is set).
  const nickname = getString(args, 'nickname');
  const ageRaw = getStringOrNumberAsString(args, 'age');
  const gender = getString(args, 'gender');
  const referralSource = getString(args, 'referral_source');

  if (nickname !== undefined) {
    if (nickname.length === 0) {
      console.log('[vapi/tool] validation_failed reason=nickname_empty');
      return { error: 'validation_failed: nickname must be a non-empty string' };
    }
    if (nickname.length > NICKNAME_MAX_LEN) {
      console.log('[vapi/tool] validation_failed reason=nickname_too_long');
      return { error: 'validation_failed: nickname too long' };
    }
    if (!NICKNAME_REGEX.test(nickname)) {
      console.log('[vapi/tool] validation_failed reason=nickname_charset');
      return {
        error: 'validation_failed: nickname may only contain letters, numbers, and underscores',
      };
    }
  }

  let parsedAge: number | undefined;
  if (ageRaw !== undefined) {
    if (!/^-?\d+$/.test(ageRaw)) {
      console.log('[vapi/tool] validation_failed reason=age_not_numeric');
      return { error: 'validation_failed: age must be a numeric string' };
    }
    parsedAge = parseInt(ageRaw, 10);
    if (!Number.isInteger(parsedAge) || parsedAge < AGE_MIN || parsedAge > AGE_MAX) {
      console.log('[vapi/tool] validation_failed reason=age_out_of_range');
      return { error: `validation_failed: age must be between ${AGE_MIN} and ${AGE_MAX}` };
    }
  }

  if (gender !== undefined && !isGenderOption(gender)) {
    console.log('[vapi/tool] validation_failed reason=gender_not_in_enum');
    return { error: 'validation_failed: gender must be Male, Female, or Other' };
  }

  if (referralSource !== undefined && referralSource.length > REFERRAL_MAX_LEN) {
    console.log('[vapi/tool] validation_failed reason=referral_source_too_long');
    return { error: 'validation_failed: referral_source too long' };
  }

  // 3. Build camelCase payload mirroring api/onboarding/[...path].ts data shape.
  const data: Record<string, unknown> = {};
  if (nickname !== undefined) data.nickname = nickname;
  if (parsedAge !== undefined) data.age = parsedAge;
  if (gender !== undefined) data.gender = gender;
  if (referralSource !== undefined) data.referralSource = referralSource;

  // Reject calls with no fields at all — Vapi shouldn't ever send these,
  // and writing an empty merge wastes a row update + Realtime event.
  if (Object.keys(data).length === 0) {
    console.log('[vapi/tool] validation_failed reason=no_fields_supplied');
    return { error: 'validation_failed: at least one field must be supplied' };
  }

  // 4. UPSERT into onboarding_states. DATA ONLY — current_step is not touched
  // on UPDATE. Navigation is the navigate_next tool's responsibility now.
  // INSERT path (defensive — onboarding init usually creates the row) seeds
  // current_step=1 since submit_profile fires from step-1.
  const result = await pool.query(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 1, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()`,
    [anonId, JSON.stringify(data)],
  );

  console.log(`[vapi/tool] submit_profile written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
