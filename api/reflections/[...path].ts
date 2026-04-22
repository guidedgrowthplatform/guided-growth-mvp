import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { waitUntil } from '@vercel/functions';
import pool from '../_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { validateDate, validateUUID, sanitizeContent } from '../_lib/validation.js';
import { sendEmail, type EmailSendResult } from '../_lib/resend-client.js';
import { renderFeedbackAlert } from '../_lib/email-templates/feedback-alert.js';
import {
  generateReflectionInsight,
  computeContentHash,
  type GenerationInput,
} from '../_lib/ai-gateway.js';

const DEFAULT_FIELDS = [
  { id: 'wins', label: 'Wins', order: 0 },
  { id: 'challenges', label: 'Challenges', order: 1 },
  { id: 'gratitude', label: 'Gratitude', order: 2 },
];

const JOURNAL_SELECT = `
  je.id, je.user_id, je.type, je.template_id, je.title,
  je.date::text, je.created_at, je.updated_at,
  je.mood, je.ai_insight, je.ai_insight_generated_at,
  jf.field_key, jf.content
`;

function normalizeNullableString(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

interface JournalRow {
  id: string;
  user_id: string;
  type: string;
  template_id: string | null;
  title: string | null;
  date: string;
  created_at: string;
  updated_at: string;
  mood: string | null;
  ai_insight: string | null;
  ai_insight_generated_at: string | null;
  field_key: string | null;
  content: string | null;
}

function rowsToEntry(rows: JournalRow[]) {
  const r0 = rows[0];
  const fields: Record<string, string> = {};
  for (const row of rows) {
    if (row.field_key) fields[row.field_key] = row.content ?? '';
  }
  return {
    id: r0.id,
    user_id: r0.user_id,
    type: r0.type,
    template_id: r0.template_id,
    title: r0.title,
    date: r0.date,
    created_at: r0.created_at,
    updated_at: r0.updated_at,
    mood: r0.mood,
    ai_insight: r0.ai_insight,
    ai_insight_generated_at: r0.ai_insight_generated_at,
    fields,
  };
}

function rowsToEntries(rows: JournalRow[]) {
  const map = new Map<string, JournalRow[]>();
  const order: string[] = [];
  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, []);
      order.push(row.id);
    }
    map.get(row.id)!.push(row);
  }
  return order.map((id) => rowsToEntry(map.get(id)!));
}

function htmlToPlain(html: string): string {
  if (!html) return '';
  return html
    .replace(/<\/\s*(p|div|li|h[1-6]|blockquote)\s*>/gi, '\n')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function extractBodyText(entry: {
  type: string;
  title: string | null;
  fields: Record<string, string>;
}): string {
  const fields = entry.fields ?? {};
  if (fields.body?.trim()) return htmlToPlain(fields.body);
  if (fields.reflection?.trim()) return htmlToPlain(fields.reflection);
  const joined = Object.values(fields)
    .map((v) => htmlToPlain(v ?? ''))
    .filter((v) => v.length > 0)
    .slice(0, 2)
    .join(' · ');
  if (joined) return joined;
  return entry.title?.trim() ?? '';
}

async function fetchRecentContext(userId: string, excludeEntryId: string) {
  const res = await pool.query<{
    created_at: string;
    mood: string | null;
    type: string;
    title: string | null;
    fields: Record<string, string>;
  }>(
    `SELECT je.created_at, je.mood, je.type, je.title,
            COALESCE(jsonb_object_agg(jf.field_key, jf.content)
                     FILTER (WHERE jf.field_key IS NOT NULL), '{}'::jsonb)
                     AS fields
     FROM journal_entries je
     LEFT JOIN journal_entry_fields jf ON jf.entry_id = je.id
     WHERE je.user_id = $1 AND je.id <> $2
     GROUP BY je.id
     ORDER BY je.created_at DESC
     LIMIT 5`,
    [userId, excludeEntryId],
  );
  return res.rows.map((r) => ({
    createdAt: r.created_at,
    mood: r.mood,
    preview: extractBodyText(r).slice(0, 200),
  }));
}

async function generateAndStoreInsight(params: {
  userId: string;
  entryId: string;
  fields: Record<string, string>;
  mood: string | null;
  type: string;
  title: string | null;
}): Promise<string | null> {
  const { userId, entryId, fields, mood, type, title } = params;
  const bodyText = extractBodyText({ type, title, fields });
  if (!bodyText.trim()) return null;

  const contentHash = computeContentHash({ fields, mood });
  const recentContext = await fetchRecentContext(userId, entryId);

  const input: GenerationInput = {
    userId,
    bodyText,
    mood,
    recentContext,
  };
  const insight = await generateReflectionInsight(input);
  if (!insight) return null;

  await pool.query(
    `UPDATE journal_entries
     SET ai_insight = $1,
         ai_insight_generated_at = now(),
         ai_insight_content_hash = $2
     WHERE id = $3 AND user_id = $4
       AND (ai_insight_content_hash IS DISTINCT FROM $2)`,
    [insight, contentHash, entryId, userId],
  );
  return insight;
}

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
      const { type, template_id, title, date, fields } = req.body ?? {};

      if (type !== 'freeform' && type !== 'template') {
        return res.status(400).json({ error: 'type must be "freeform" or "template"' });
      }
      const validDate = validateDate(date);
      if (!validDate) return res.status(400).json({ error: 'Invalid date (YYYY-MM-DD)' });
      if (type === 'template' && (!template_id || typeof template_id !== 'string')) {
        return res.status(400).json({ error: 'template_id required for template type' });
      }
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
        return res.status(400).json({ error: 'fields must be an object' });
      }
      const fieldEntries = Object.entries(fields).filter(
        ([, v]) => typeof v === 'string' && (v as string).trim(),
      );
      if (fieldEntries.length === 0) {
        return res.status(400).json({ error: 'At least one non-empty field required' });
      }

      const mood = normalizeNullableString(req.body?.mood, 32);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const ins = await client.query(
          `INSERT INTO journal_entries
             (user_id, type, template_id, title, date, mood)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, user_id, type, template_id, title, date::text,
                     created_at, updated_at,
                     mood, ai_insight, ai_insight_generated_at`,
          [
            user.id,
            type,
            type === 'template' ? template_id : null,
            title?.trim() || null,
            validDate,
            mood ?? null,
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

        waitUntil(
          generateAndStoreInsight({
            userId: user.id,
            entryId: entry.id,
            fields: fieldsMap,
            mood: entry.mood,
            type: entry.type,
            title: entry.title,
          }).catch(() => null),
        );

        return res.status(201).json({ ...entry, fields: fieldsMap });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    if (req.method === 'GET' && !journalSub) {
      const hasDateRange = req.query.start || req.query.end;
      const rawLimit = parseInt(String(req.query.limit ?? ''), 10);
      const rawPage = parseInt(String(req.query.page ?? ''), 10);
      const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(50, rawLimit))
        : hasDateRange
          ? null
          : 20;
      const page = Number.isFinite(rawPage) ? Math.max(0, rawPage) : 0;

      let rows: JournalRow[];

      if (hasDateRange) {
        const start = validateDate(req.query.start);
        const end = validateDate(req.query.end);
        if (!start || !end) {
          return res.status(400).json({ error: 'Valid start and end dates required (YYYY-MM-DD)' });
        }
        const result = await pool.query<JournalRow>(
          `SELECT ${JOURNAL_SELECT}
           FROM journal_entries je
           LEFT JOIN journal_entry_fields jf ON jf.entry_id = je.id
           WHERE je.user_id = $1 AND je.date >= $2 AND je.date <= $3
           ORDER BY je.created_at DESC`,
          [user.id, start, end],
        );
        rows = result.rows;
      } else {
        const idsResult = await pool.query<{ id: string }>(
          `SELECT id FROM journal_entries
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [user.id, limit!, page * limit!],
        );
        if (idsResult.rows.length === 0) return res.json([]);
        const ids = idsResult.rows.map((r) => r.id);
        const result = await pool.query<JournalRow>(
          `SELECT ${JOURNAL_SELECT}
           FROM journal_entries je
           LEFT JOIN journal_entry_fields jf ON jf.entry_id = je.id
           WHERE je.id = ANY($1::uuid[])
           ORDER BY je.created_at DESC`,
          [ids],
        );
        rows = result.rows;
      }

      return res.json(rowsToEntries(rows));
    }

    // POST /api/reflections/journal/:id/insight — lazy-backfill AI insight
    if (journalSub && segments[2] === 'insight' && req.method === 'POST') {
      const entryId = validateUUID(journalSub);
      if (!entryId) return res.status(400).json({ error: 'Invalid entry ID' });

      const result = await pool.query<JournalRow>(
        `SELECT ${JOURNAL_SELECT}
         FROM journal_entries je
         LEFT JOIN journal_entry_fields jf ON jf.entry_id = je.id
         WHERE je.id = $1 AND je.user_id = $2`,
        [entryId, user.id],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      const entry = rowsToEntry(result.rows);

      if (entry.ai_insight) {
        return res.json({ ai_insight: entry.ai_insight });
      }

      const insight = await generateAndStoreInsight({
        userId: user.id,
        entryId,
        fields: entry.fields,
        mood: entry.mood,
        type: entry.type,
        title: entry.title,
      });
      return res.json({ ai_insight: insight });
    }

    // GET/PUT/DELETE /api/reflections/journal/:id
    if (journalSub) {
      const entryId = validateUUID(journalSub);
      if (!entryId) return res.status(400).json({ error: 'Invalid entry ID' });

      if (req.method === 'GET') {
        const result = await pool.query<JournalRow>(
          `SELECT ${JOURNAL_SELECT}
           FROM journal_entries je
           LEFT JOIN journal_entry_fields jf ON jf.entry_id = je.id
           WHERE je.id = $1 AND je.user_id = $2`,
          [entryId, user.id],
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        return res.json(rowsToEntry(result.rows));
      }

      if (req.method === 'PUT') {
        const { title, fields } = req.body ?? {};
        if (fields && (typeof fields !== 'object' || Array.isArray(fields))) {
          return res.status(400).json({ error: 'fields must be an object' });
        }

        const mood = normalizeNullableString(req.body?.mood, 32);

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

          const sets: string[] = ['updated_at = now()'];
          const params: unknown[] = [];
          let idx = 1;
          if (title !== undefined) {
            sets.push(`title = $${idx++}`);
            params.push(title?.trim() || null);
          }
          if (mood !== undefined) {
            sets.push(`mood = $${idx++}`);
            params.push(mood);
          }
          params.push(entryId);
          await client.query(
            `UPDATE journal_entries SET ${sets.join(', ')} WHERE id = $${idx}`,
            params,
          );

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

          const updated = await pool.query<JournalRow>(
            `SELECT ${JOURNAL_SELECT}
             FROM journal_entries je
             LEFT JOIN journal_entry_fields jf ON jf.entry_id = je.id
             WHERE je.id = $1 AND je.user_id = $2`,
            [entryId, user.id],
          );
          const updatedEntry = rowsToEntry(updated.rows);

          const newHash = computeContentHash({
            fields: updatedEntry.fields,
            mood: updatedEntry.mood,
          });
          const hashRow = await pool.query<{ ai_insight_content_hash: string | null }>(
            `SELECT ai_insight_content_hash FROM journal_entries WHERE id = $1`,
            [entryId],
          );
          if (hashRow.rows[0]?.ai_insight_content_hash !== newHash) {
            waitUntil(
              generateAndStoreInsight({
                userId: user.id,
                entryId,
                fields: updatedEntry.fields,
                mood: updatedEntry.mood,
                type: updatedEntry.type,
                title: updatedEntry.title,
              }).catch(() => null),
            );
          }
          return res.json(updatedEntry);
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
      const inserted = result.rows[0];

      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
      if (adminEmail) {
        const {
          subject,
          html,
          text: plain,
        } = renderFeedbackAlert({
          sentiment,
          text: feedbackText,
          userEmail: user.email,
          submittedAt: new Date(inserted.created_at).toISOString(),
        });
        const emailResult = await Promise.race<EmailSendResult>([
          sendEmail({
            to: adminEmail,
            subject,
            html,
            text: plain,
            tags: [{ name: 'category', value: 'feedback-alert' }],
            headers: {
              'List-Unsubscribe': `<mailto:${adminEmail}?subject=unsubscribe>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }),
          new Promise<EmailSendResult>((resolve) =>
            setTimeout(() => resolve({ ok: false, status: 504 }), 3100),
          ),
        ]);
        if (!emailResult.ok) {
          console.error('feedback_email_failed', {
            status: emailResult.status,
            sentiment,
          });
        }
      }

      return res.status(201).json(inserted);
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
