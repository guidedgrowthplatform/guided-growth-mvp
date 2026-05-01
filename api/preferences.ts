import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from './_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from './_lib/auth.js';

const VOICE_MODES = ['voice', 'screen', 'always_ask'] as const;
const RECORDING_MODES = ['auto-stop', 'always-on'] as const;
const VIEW_MODES = ['spreadsheet', 'form'] as const;
const SPREADSHEET_RANGES = ['week', 'month'] as const;

const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

const DEFAULTS = {
  default_view: 'spreadsheet',
  spreadsheet_range: 'month',
  voice_mode: 'voice',
  mic_enabled: true,
  mic_permission: false,
  recording_mode: 'auto-stop',
  voice_model: 'default',
  coaching_style: 'friendly',
  language: 'en',
  morning_time: '08:00',
  night_time: '21:00',
  push_notifications: true,
};

const SELECT_COLUMNS = Object.keys(DEFAULTS).join(', ');

type Validator = (v: unknown) => boolean;
const VALIDATORS: Record<string, Validator> = {
  default_view: (v) => typeof v === 'string' && (VIEW_MODES as readonly string[]).includes(v),
  spreadsheet_range: (v) =>
    typeof v === 'string' && (SPREADSHEET_RANGES as readonly string[]).includes(v),
  voice_mode: (v) => typeof v === 'string' && (VOICE_MODES as readonly string[]).includes(v),
  recording_mode: (v) =>
    typeof v === 'string' && (RECORDING_MODES as readonly string[]).includes(v),
  mic_enabled: (v) => typeof v === 'boolean',
  mic_permission: (v) => typeof v === 'boolean',
  push_notifications: (v) => typeof v === 'boolean',
  voice_model: (v) => typeof v === 'string' && v.length > 0 && v.length <= 50,
  coaching_style: (v) => typeof v === 'string' && v.length > 0 && v.length <= 50,
  language: (v) => typeof v === 'string' && v.length > 0 && v.length <= 10,
  morning_time: (v) => typeof v === 'string' && TIME_RE.test(v),
  night_time: (v) => typeof v === 'string' && TIME_RE.test(v),
};

const ALLOWED_COLUMNS = new Set(Object.keys(VALIDATORS));

function normaliseTime(v: string): string {
  // DB returns 'HH:MM:SS'; trim to HH:MM for client consistency
  return v.length >= 5 ? v.slice(0, 5) : v;
}

function shapeRow(row: Record<string, unknown> | undefined) {
  if (!row) return { ...DEFAULTS };
  return {
    ...DEFAULTS,
    ...row,
    morning_time: normaliseTime((row.morning_time as string | undefined) ?? DEFAULTS.morning_time),
    night_time: normaliseTime((row.night_time as string | undefined) ?? DEFAULTS.night_time),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  const user = await requireUser(req, res);
  if (!user) return;
  await setUserContext(user.id);

  if (req.method === 'GET') {
    const result = await pool.query(
      `SELECT ${SELECT_COLUMNS} FROM user_preferences WHERE user_id = $1`,
      [user.id],
    );
    return res.json(shapeRow(result.rows[0]));
  }

  if (req.method === 'PUT') {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      if (!ALLOWED_COLUMNS.has(key)) {
        return res.status(400).json({ error: `Unknown field: ${key}` });
      }
      const value = body[key];
      if (!VALIDATORS[key](value)) {
        return res.status(400).json({ error: `Invalid value for ${key}` });
      }
      updates[key] = value;
    }

    const keys = Object.keys(updates);
    if (keys.length === 0) {
      const result = await pool.query(
        `SELECT ${SELECT_COLUMNS} FROM user_preferences WHERE user_id = $1`,
        [user.id],
      );
      return res.json(shapeRow(result.rows[0]));
    }

    // column names interpolated from ALLOWED_COLUMNS whitelist — safe
    const insertCols = ['user_id', ...keys];
    const insertPlaceholders = insertCols.map((_, i) => `$${i + 1}`);
    const insertValues = [user.id, ...keys.map((k) => updates[k])];
    const updateAssignments = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const sql = `INSERT INTO user_preferences (${insertCols.join(', ')})
                 VALUES (${insertPlaceholders.join(', ')})
                 ON CONFLICT (user_id) DO UPDATE SET ${updateAssignments}, updated_at = now()
                 RETURNING ${SELECT_COLUMNS}`;

    const result = await pool.query(sql, insertValues);
    return res.json(shapeRow(result.rows[0]));
  }

  res.status(405).json({ error: 'Method not allowed' });
}
