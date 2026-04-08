import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  const user = await requireUser(req, res);
  if (!user) return;
  await setUserContext(user.id);

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  if (route === '' && req.method === 'GET') {
    const result = await pool.query(
      'SELECT id, user_id, path, current_step, status, data, brain_dump_raw, brain_dump_parsed, completed_at FROM onboarding_states WHERE user_id = $1',
      [user.id],
    );
    return res.json(result.rows[0] || null);
  }

  if (route === '' && req.method === 'PUT') {
    const { step, path, data, brainDumpRaw, brainDumpParsed } = req.body;

    if (step === undefined || step === null) {
      return res.status(400).json({ error: 'step is required' });
    }

    const result = await pool.query(
      `INSERT INTO onboarding_states (user_id, current_step, path, status, data, brain_dump_raw, brain_dump_parsed, updated_at)
       VALUES ($1, $2, $3, 'in_progress', $4::jsonb, $5, $6::jsonb, now())
       ON CONFLICT (user_id) DO UPDATE SET
         current_step = GREATEST(onboarding_states.current_step, $2),
         path = COALESCE($3, onboarding_states.path),
         status = 'in_progress',
         data = onboarding_states.data || $4::jsonb,
         brain_dump_raw = COALESCE($5, onboarding_states.brain_dump_raw),
         brain_dump_parsed = COALESCE($6::jsonb, onboarding_states.brain_dump_parsed),
         updated_at = now()
       RETURNING id, user_id, path, current_step, status, data, brain_dump_raw, brain_dump_parsed, completed_at`,
      [
        user.id,
        step,
        path || null,
        JSON.stringify(data || {}),
        brainDumpRaw || null,
        brainDumpParsed ? JSON.stringify(brainDumpParsed) : null,
      ],
    );

    return res.json(result.rows[0]);
  }

  if (route === 'complete' && req.method === 'POST') {
    const { finalData } = req.body || {};
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const stateResult = await client.query(
        `UPDATE onboarding_states
         SET data = onboarding_states.data || $2::jsonb,
             status = 'completed', completed_at = now(), updated_at = now()
         WHERE user_id = $1
         RETURNING id, path, data`,
        [user.id, JSON.stringify(finalData || {})],
      );

      if (stateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'No onboarding state found' });
      }

      const { path: onboardingPath, data } = stateResult.rows[0];
      const habitConfigs = data?.habitConfigs as
        | Record<string, { days: number[]; time: string; reminder: boolean }>
        | undefined;

      if (habitConfigs) {
        let sortOrder = 0;
        for (const [name, config] of Object.entries(habitConfigs)) {
          await client.query(
            `INSERT INTO user_habits (user_id, name, habit_type, cadence, schedule_days, reminder_time, reminder_enabled, sort_order)
             VALUES ($1, $2, 'binary_do', 'daily', $3, $4, $5, $6)
             ON CONFLICT (user_id, name) DO UPDATE SET
               schedule_days = EXCLUDED.schedule_days,
               reminder_time = EXCLUDED.reminder_time,
               reminder_enabled = EXCLUDED.reminder_enabled,
               sort_order = EXCLUDED.sort_order`,
            [
              user.id,
              name,
              config.days || null,
              config.time || null,
              config.reminder || false,
              sortOrder++,
            ],
          );
        }
      }

      await client.query(
        `UPDATE profiles SET
          onboarding_path = $1,
          nickname = COALESCE($3, profiles.nickname),
          age_group = COALESCE($4, profiles.age_group),
          gender = COALESCE($5, profiles.gender),
          referral_source = COALESCE($6, profiles.referral_source)
         WHERE id = $2`,
        [
          onboardingPath,
          user.id,
          data?.nickname || null,
          data?.ageRange || null,
          data?.gender || null,
          data?.referralSource &&
          typeof data.referralSource === 'string' &&
          data.referralSource.length <= 50
            ? data.referralSource
            : null,
        ],
      );

      await client.query('COMMIT');
      return res.json({ message: 'Onboarding completed' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Onboarding complete error:', err);
      return res.status(500).json({ error: 'Failed to complete onboarding' });
    } finally {
      client.release();
    }
  }

  if (route === 'delete-account' && req.method === 'DELETE') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userTables = [
        'onboarding_states',
        'user_habits',
        'user_milestones',
        'user_points',
        'user_preferences',
        'user_settings',
        'user_tracked_metrics',
        'affirmations',
        'ai_conversations',
        'daily_checkins',
        'entries',
        'focus_sessions',
        'journal_entries',
        'metrics',
        'reflection_configs',
        'reflections',
        'habit_completions',
        'metric_entries',
      ];

      for (const table of userTables) {
        await client.query(`SAVEPOINT del_${table}`);
        try {
          await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [user.id]);
        } catch {
          await client.query(`ROLLBACK TO SAVEPOINT del_${table}`);
        }
      }

      await client.query('DELETE FROM profiles WHERE id = $1', [user.id]);
      await client.query('COMMIT');
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error('Failed to delete Supabase Auth user:', deleteError);
        return res.status(500).json({ error: 'Failed to delete auth user' });
      }

      return res.json({ message: 'Account deleted' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Delete account error:', err);
      return res.status(500).json({ error: 'Failed to delete account' });
    } finally {
      client.release();
    }
  }

  return res.status(404).json({ error: 'Not found' });
}
