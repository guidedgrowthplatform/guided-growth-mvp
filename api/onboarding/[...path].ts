import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabase.js';

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

      if (data?.nickname) {
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          user_metadata: { nickname: data.nickname },
        });
      }

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

  // GET /api/onboarding/profile — fetch current profile fields
  if (route === 'profile' && req.method === 'GET') {
    const { rows } = await pool.query('SELECT name, nickname, image FROM profiles WHERE id = $1', [
      user.id,
    ]);
    return res.json(rows[0] ?? { name: null, nickname: null, image: null });
  }

  // PATCH /api/onboarding/profile — update name and/or nickname
  if (route === 'profile' && req.method === 'PATCH') {
    const { name, nickname } = req.body ?? {};

    if (
      name !== undefined &&
      (typeof name !== 'string' || name.trim().length === 0 || name.length > 100)
    ) {
      return res
        .status(400)
        .json({ error: 'name must be a non-empty string of at most 100 characters' });
    }
    if (nickname !== undefined) {
      if (typeof nickname !== 'string' || nickname.length > 50) {
        return res
          .status(400)
          .json({ error: 'nickname must be a string of at most 50 characters' });
      }
      if (!/^[a-zA-Z0-9_]*$/.test(nickname)) {
        return res
          .status(400)
          .json({ error: 'nickname may only contain letters, numbers, and underscores' });
      }
    }

    const updates: string[] = [];
    const values: unknown[] = [user.id];

    if (name !== undefined) {
      values.push(name);
      updates.push(`name = $${values.length}`);
    }
    if (nickname !== undefined) {
      values.push(nickname);
      updates.push(`nickname = $${values.length}`);
    }

    if (updates.length > 0) {
      await pool.query(`UPDATE profiles SET ${updates.join(', ')} WHERE id = $1`, values);
      // Keep Supabase user_metadata in sync so mapUser() reads fresh data after session refresh
      const metaPatch: Record<string, string> = {};
      if (name !== undefined) metaPatch.full_name = name;
      if (nickname !== undefined) metaPatch.nickname = nickname;
      await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: metaPatch });
    }

    return res.json({ ok: true });
  }

  // POST /api/onboarding/profile — upload avatar to Supabase Storage
  if (route === 'profile' && req.method === 'POST') {
    const { dataUrl } = req.body ?? {};
    if (typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'dataUrl is required' });
    }

    // Guard raw base64 string size before decoding (~33% overhead)
    if (Buffer.byteLength(dataUrl, 'utf8') > 3 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large' });
    }

    // Parse and validate MIME type from data URL prefix
    const mimeMatch = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
    if (!mimeMatch) {
      return res.status(400).json({ error: 'Invalid image format' });
    }
    const mimeType = mimeMatch[1];
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const ext = extMap[mimeType];
    if (!ext) {
      return res
        .status(400)
        .json({ error: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' });
    }

    // Decode and validate decoded size
    const base64Data = dataUrl.slice(mimeMatch[0].length);
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.byteLength > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large (max 2MB)' });
    }

    // Magic-byte check to prevent MIME spoofing
    const isValidMagic = (() => {
      if (mimeType === 'image/png')
        return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
      if (mimeType === 'image/jpeg')
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      if (mimeType === 'image/webp')
        return (
          buffer[0] === 0x52 &&
          buffer[1] === 0x49 &&
          buffer[2] === 0x46 &&
          buffer[3] === 0x46 &&
          buffer[8] === 0x57 &&
          buffer[9] === 0x45 &&
          buffer[10] === 0x42 &&
          buffer[11] === 0x50
        );
      if (mimeType === 'image/gif')
        return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
      return false;
    })();
    if (!isValidMagic) {
      return res.status(400).json({ error: 'Image content does not match declared type' });
    }

    // Upload to Supabase Storage — userId is a verified UUID so path is safe
    const storagePath = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      return res.status(500).json({ error: 'Failed to upload image' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const imageUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${storagePath}`;

    await pool.query('UPDATE profiles SET image = $1 WHERE id = $2', [imageUrl, user.id]);
    // Keep user_metadata in sync so mapUser() reads the new avatar after session refresh
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { avatar_url: imageUrl },
    });

    return res.json({ imageUrl });
  }

  return res.status(404).json({ error: 'Not found' });
}
