import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import pool from '../_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { validateDate, validateUUID, sanitizeContent } from '../_lib/validation.js';

const DEFAULT_FIELDS = [
  { id: 'wins', label: 'Wins', order: 0 },
  { id: 'challenges', label: 'Challenges', order: 1 },
  { id: 'gratitude', label: 'Gratitude', order: 2 },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  const user = await requireUser(req, res);
  if (!user) return;
  await setUserContext(user.id);

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  // ── Journal entries ──────────────────────────────────
  if (route === 'journal') {
    const journalSub = segments[1] || '';

    // POST /api/reflections/journal/upload — upload image
    if (journalSub === 'upload' && req.method === 'POST') {
      const { data, contentType } = req.body ?? {};

      if (!data || typeof data !== 'string' || !contentType || typeof contentType !== 'string') {
        return res.status(400).json({ error: 'data (base64 string) and contentType required' });
      }

      const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
      if (!ALLOWED_TYPES.includes(contentType)) {
        return res.status(400).json({ error: 'Only JPEG, PNG, and WebP allowed' });
      }

      // Validate base64 format
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length === 0) {
        return res.status(400).json({ error: 'Invalid base64 data' });
      }

      const buffer = Buffer.from(data, 'base64');
      const MAX_SIZE = 3 * 1024 * 1024; // 3MB binary (base64 inflates ~33%, must fit Vercel's 4.5MB body limit)
      if (buffer.length > MAX_SIZE) {
        return res.status(400).json({ error: 'Image must be under 3MB' });
      }

      const ext = contentType.split('/')[1] === 'jpeg' ? 'jpg' : contentType.split('/')[1];
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('journal-images')
        .upload(path, buffer, { contentType, upsert: false });

      if (uploadError) {
        return res.status(500).json({ error: 'Upload failed: ' + uploadError.message });
      }

      const { data: urlData } = supabaseAdmin.storage.from('journal-images').getPublicUrl(path);

      return res.status(201).json({ url: urlData.publicUrl });
    }

    // POST /api/reflections/journal — create entry
    if (req.method === 'POST' && !journalSub) {
      const { type, template_id, title, date, fields, habit_id } = req.body ?? {};

      // Validate type
      if (type !== 'freeform' && type !== 'template') {
        return res.status(400).json({ error: 'type must be "freeform" or "template"' });
      }
      // Validate date
      const validDate = validateDate(date);
      if (!validDate) return res.status(400).json({ error: 'Invalid date (YYYY-MM-DD)' });
      // Validate template_id
      if (type === 'template' && (!template_id || typeof template_id !== 'string')) {
        return res.status(400).json({ error: 'template_id required for template type' });
      }
      // Validate optional habit_id
      let validHabitId: string | null = null;
      if (habit_id != null && habit_id !== '') {
        const v = validateUUID(habit_id);
        if (!v) return res.status(400).json({ error: 'Invalid habit_id' });
        validHabitId = v;
      }
      // Validate fields
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
        return res.status(400).json({ error: 'fields must be an object' });
      }
      const fieldEntries = Object.entries(fields).filter(
        ([, v]) => typeof v === 'string' && (v as string).trim(),
      );
      if (fieldEntries.length === 0) {
        return res.status(400).json({ error: 'At least one non-empty field required' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const ins = await client.query(
          `INSERT INTO journal_entries (user_id, type, template_id, title, date, habit_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, user_id, type, template_id, title, date::text, habit_id, created_at, updated_at`,
          [
            user.id,
            type,
            type === 'template' ? template_id : null,
            title?.trim() || null,
            validDate,
            validHabitId,
          ],
        );
        const entry = ins.rows[0];
        const fieldsMap: Record<string, string> = {};
        for (const [key, value] of fieldEntries) {
          const sanitized = sanitizeContent(value as string);
          await client.query(
            `INSERT INTO journal_entry_fields (entry_id, field_key, content) VALUES ($1, $2, $3)`,
            [entry.id, key, sanitized],
          );
          fieldsMap[key] = sanitized;
        }
        await client.query('COMMIT');
        return res.status(201).json({ ...entry, fields: fieldsMap });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // GET /api/reflections/journal?start=&end=&habitId= — list entries
    if (req.method === 'GET' && !journalSub) {
      const start = validateDate(req.query.start);
      const end = validateDate(req.query.end);
      if (!start || !end) {
        return res.status(400).json({ error: 'Valid start and end dates required (YYYY-MM-DD)' });
      }
      const habitIdRaw = req.query.habitId;
      let habitFilter: string | null = null;
      if (typeof habitIdRaw === 'string' && habitIdRaw.length > 0) {
        const v = validateUUID(habitIdRaw);
        if (!v) return res.status(400).json({ error: 'Invalid habitId' });
        habitFilter = v;
      }
      const sql = habitFilter
        ? `SELECT je.id, je.user_id, je.type, je.template_id, je.title,
                  je.date::text, je.habit_id, je.created_at, je.updated_at,
                  jf.field_key, jf.content
           FROM journal_entries je
           LEFT JOIN journal_entry_fields jf ON jf.entry_id = je.id
           WHERE je.user_id = $1 AND je.date >= $2 AND je.date <= $3 AND je.habit_id = $4
           ORDER BY je.created_at DESC`
        : `SELECT je.id, je.user_id, je.type, je.template_id, je.title,
                  je.date::text, je.habit_id, je.created_at, je.updated_at,
                  jf.field_key, jf.content
           FROM journal_entries je
           LEFT JOIN journal_entry_fields jf ON jf.entry_id = je.id
           WHERE je.user_id = $1 AND je.date >= $2 AND je.date <= $3
           ORDER BY je.created_at DESC`;
      const params = habitFilter ? [user.id, start, end, habitFilter] : [user.id, start, end];
      const result = await pool.query(sql, params);
      const entriesMap = new Map<string, Record<string, unknown>>();
      for (const row of result.rows) {
        if (!entriesMap.has(row.id)) {
          entriesMap.set(row.id, {
            id: row.id,
            user_id: row.user_id,
            type: row.type,
            template_id: row.template_id,
            title: row.title,
            date: row.date,
            habit_id: row.habit_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
            fields: {} as Record<string, string>,
          });
        }
        if (row.field_key) {
          (entriesMap.get(row.id)!.fields as Record<string, string>)[row.field_key] = row.content;
        }
      }
      return res.json(Array.from(entriesMap.values()));
    }

    // GET/PUT/DELETE /api/reflections/journal/:id
    if (journalSub) {
      const entryId = validateUUID(journalSub);
      if (!entryId) return res.status(400).json({ error: 'Invalid entry ID' });

      if (req.method === 'GET') {
        const result = await pool.query(
          `SELECT je.id, je.user_id, je.type, je.template_id, je.title,
                  je.date::text, je.habit_id, je.created_at, je.updated_at,
                  jf.field_key, jf.content
           FROM journal_entries je
           LEFT JOIN journal_entry_fields jf ON jf.entry_id = je.id
           WHERE je.id = $1 AND je.user_id = $2`,
          [entryId, user.id],
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        const row0 = result.rows[0];
        const fields: Record<string, string> = {};
        for (const row of result.rows) {
          if (row.field_key) fields[row.field_key] = row.content;
        }
        return res.json({
          id: row0.id,
          user_id: row0.user_id,
          type: row0.type,
          template_id: row0.template_id,
          title: row0.title,
          date: row0.date,
          habit_id: row0.habit_id,
          created_at: row0.created_at,
          updated_at: row0.updated_at,
          fields,
        });
      }

      if (req.method === 'PUT') {
        const { title, fields } = req.body ?? {};
        if (fields && (typeof fields !== 'object' || Array.isArray(fields))) {
          return res.status(400).json({ error: 'fields must be an object' });
        }
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const check = await client.query(
            'SELECT id FROM journal_entries WHERE id = $1 AND user_id = $2',
            [entryId, user.id],
          );
          if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Not found' });
          }
          if (title !== undefined) {
            await client.query(
              `UPDATE journal_entries SET title = $1, updated_at = now() WHERE id = $2`,
              [title?.trim() || null, entryId],
            );
          } else {
            await client.query(`UPDATE journal_entries SET updated_at = now() WHERE id = $1`, [
              entryId,
            ]);
          }
          if (fields) {
            await client.query('DELETE FROM journal_entry_fields WHERE entry_id = $1', [entryId]);
            for (const [key, value] of Object.entries(fields)) {
              if (typeof value === 'string' && value.trim()) {
                await client.query(
                  'INSERT INTO journal_entry_fields (entry_id, field_key, content) VALUES ($1, $2, $3)',
                  [entryId, key, sanitizeContent(value)],
                );
              }
            }
          }
          await client.query('COMMIT');
          // Re-fetch
          const updated = await pool.query(
            `SELECT je.id, je.user_id, je.type, je.template_id, je.title,
                    je.date::text, je.habit_id, je.created_at, je.updated_at,
                    jf.field_key, jf.content
             FROM journal_entries je
             LEFT JOIN journal_entry_fields jf ON jf.entry_id = je.id
             WHERE je.id = $1 AND je.user_id = $2`,
            [entryId, user.id],
          );
          const r0 = updated.rows[0];
          const updatedFields: Record<string, string> = {};
          for (const r of updated.rows) {
            if (r.field_key) updatedFields[r.field_key] = r.content;
          }
          return res.json({
            id: r0.id,
            user_id: r0.user_id,
            type: r0.type,
            template_id: r0.template_id,
            title: r0.title,
            date: r0.date,
            habit_id: r0.habit_id,
            created_at: r0.created_at,
            updated_at: r0.updated_at,
            fields: updatedFields,
          });
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }

      if (req.method === 'DELETE') {
        const result = await pool.query(
          'DELETE FROM journal_entries WHERE id = $1 AND user_id = $2 RETURNING id',
          [entryId, user.id],
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        return res.json({ message: 'Deleted' });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Feedback ──────────────────────────────────────────
  if (route === 'feedback') {
    if (req.method === 'POST') {
      const { sentiment, text } = req.body ?? {};
      if (!sentiment || !['love', 'ok', 'needs-work'].includes(sentiment)) {
        return res.status(400).json({ error: 'sentiment must be love, ok, or needs-work' });
      }
      const feedbackText = sanitizeContent(typeof text === 'string' ? text.trim() : '');
      if (feedbackText.length > 5000) {
        return res.status(400).json({ error: 'Feedback text too long (max 5000 characters)' });
      }
      const result = await pool.query(
        `INSERT INTO feedback (user_id, sentiment, text)
         VALUES ($1, $2, $3)
         RETURNING id, sentiment, text, created_at`,
        [user.id, sentiment, feedbackText],
      );
      return res.status(201).json(result.rows[0]);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // GET/PUT /api/reflections/config
  if (route === 'config') {
    if (req.method === 'GET') {
      const result = await pool.query(
        'SELECT fields, show_affirmation FROM reflection_configs WHERE user_id = $1',
        [user.id],
      );
      if (result.rows.length === 0)
        return res.json({ fields: DEFAULT_FIELDS, show_affirmation: true });
      return res.json(result.rows[0]);
    }
    if (req.method === 'PUT') {
      const { fields, show_affirmation } = req.body;
      await pool.query(
        `INSERT INTO reflection_configs (user_id, fields, show_affirmation) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET fields = $2, show_affirmation = $3`,
        [user.id, JSON.stringify(fields), show_affirmation],
      );
      return res.json({ fields, show_affirmation });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // PUT /api/reflections/:date
  if (route) {
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
    const date = validateDate(route);
    if (!date) return res.status(400).json({ error: 'Invalid date format (YYYY-MM-DD)' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [fieldId, value] of Object.entries(req.body)) {
        if (value === '' || value === null || value === undefined) {
          await client.query(
            'DELETE FROM reflections WHERE user_id = $1 AND date = $2 AND field_id = $3',
            [user.id, date, fieldId],
          );
        } else {
          await client.query(
            `INSERT INTO reflections (user_id, date, field_id, value) VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, date, field_id) DO UPDATE SET value = $4`,
            [user.id, date, fieldId, value],
          );
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return res.json({ message: 'Saved' });
  }

  // GET /api/reflections?start=&end=
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const start = validateDate(req.query.start);
  const end = validateDate(req.query.end);
  if (!start || !end)
    return res.status(400).json({ error: 'Valid start and end dates required (YYYY-MM-DD)' });

  const result = await pool.query(
    'SELECT date::text, field_id, value FROM reflections WHERE user_id = $1 AND date >= $2 AND date <= $3',
    [user.id, start, end],
  );

  const map: Record<string, Record<string, string>> = {};
  for (const row of result.rows) {
    if (!map[row.date]) map[row.date] = {};
    map[row.date][row.field_id] = row.value;
  }
  res.json(map);
}
