import type { JournalEntry } from '@gg/shared/types';
import pool from '../db.js';
import { sanitizeContent } from '../validation.js';

export interface CreateJournalEntryInput {
  anon_id: string;
  type: 'freeform' | 'template';
  template_id?: string | null;
  title?: string | null;
  date: string;
  habit_id?: string | null;
  fields: Record<string, string>;
}

export async function createJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO journal_entries (anon_id, type, template_id, title, date, habit_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, anon_id, type, template_id, title, date::text, habit_id, created_at, updated_at`,
      [
        input.anon_id,
        input.type,
        input.type === 'template' ? (input.template_id ?? null) : null,
        input.title?.trim() || null,
        input.date,
        input.habit_id ?? null,
      ],
    );
    const entry = ins.rows[0];
    const fieldsMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.fields)) {
      if (typeof value !== 'string' || !value.trim()) continue;
      const sanitized = sanitizeContent(value);
      await client.query(
        `INSERT INTO journal_entry_fields (entry_id, field_key, content) VALUES ($1, $2, $3)`,
        [entry.id, key, sanitized],
      );
      fieldsMap[key] = sanitized;
    }
    await client.query('COMMIT');
    return { ...entry, fields: fieldsMap } as JournalEntry;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
