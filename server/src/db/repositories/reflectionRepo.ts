import pool from '../pool.js';
import type { ReflectionConfig, DayReflections } from '@life-growth-tracker/shared';
import { DEFAULT_REFLECTION_FIELDS } from '@life-growth-tracker/shared';

export const reflectionRepo = {
  async getConfig(userId: string): Promise<ReflectionConfig> {
    const result = await pool.query(
      `SELECT fields, show_affirmation FROM reflection_configs WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return { fields: DEFAULT_REFLECTION_FIELDS, show_affirmation: true };
    }
    return {
      fields: result.rows[0].fields,
      show_affirmation: result.rows[0].show_affirmation,
    };
  },

  async saveConfig(userId: string, config: ReflectionConfig): Promise<ReflectionConfig> {
    await pool.query(
      `INSERT INTO reflection_configs (user_id, fields, show_affirmation)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET fields = $2, show_affirmation = $3`,
      [userId, JSON.stringify(config.fields), config.show_affirmation]
    );
    return config;
  },

  async findByDateRange(userId: string, start: string, end: string): Promise<Record<string, DayReflections>> {
    const result = await pool.query(
      `SELECT date::text, field_id, value FROM reflections
       WHERE user_id = $1 AND date >= $2 AND date <= $3`,
      [userId, start, end]
    );

    const map: Record<string, DayReflections> = {};
    for (const row of result.rows) {
      if (!map[row.date]) map[row.date] = {};
      map[row.date][row.field_id] = row.value;
    }
    return map;
  },

  async upsertDay(userId: string, date: string, reflections: DayReflections): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [fieldId, value] of Object.entries(reflections)) {
        if (value === '' || value === null || value === undefined) {
          await client.query(
            `DELETE FROM reflections WHERE user_id = $1 AND date = $2 AND field_id = $3`,
            [userId, date, fieldId]
          );
        } else {
          await client.query(
            `INSERT INTO reflections (user_id, date, field_id, value)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, date, field_id) DO UPDATE SET value = $4`,
            [userId, date, fieldId, value]
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
  },

  async getAffirmation(userId: string): Promise<string> {
    const result = await pool.query(
      `SELECT value FROM affirmations WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]?.value || '';
  },

  async saveAffirmation(userId: string, value: string): Promise<void> {
    await pool.query(
      `INSERT INTO affirmations (user_id, value)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET value = $2`,
      [userId, value]
    );
  },

  async getPreferences(userId: string): Promise<{ default_view: string }> {
    const result = await pool.query(
      `SELECT default_view FROM user_preferences WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || { default_view: 'spreadsheet' };
  },

  async savePreferences(userId: string, prefs: { default_view: string }): Promise<void> {
    await pool.query(
      `INSERT INTO user_preferences (user_id, default_view)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET default_view = $2`,
      [userId, prefs.default_view]
    );
  },
};
