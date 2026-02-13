import pool from '../pool.js';
import type { DayEntries, EntriesMap } from '@life-growth-tracker/shared';

export const entryRepo = {
  async findByDateRange(userId: string, start: string, end: string): Promise<EntriesMap> {
    const result = await pool.query(
      `SELECT metric_id, date::text, value FROM entries
       WHERE user_id = $1 AND date >= $2 AND date <= $3`,
      [userId, start, end]
    );

    const map: EntriesMap = {};
    for (const row of result.rows) {
      const dateStr = row.date;
      if (!map[dateStr]) map[dateStr] = {};
      map[dateStr][row.metric_id] = row.value;
    }
    return map;
  },

  async upsertDay(userId: string, date: string, entries: DayEntries): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete entries for metrics not in the new set
      const metricIds = Object.keys(entries);
      if (metricIds.length > 0) {
        await client.query(
          `DELETE FROM entries WHERE user_id = $1 AND date = $2 AND metric_id NOT IN (${metricIds.map((_, i) => `$${i + 3}`).join(',')})`,
          [userId, date, ...metricIds]
        );
      } else {
        await client.query(
          `DELETE FROM entries WHERE user_id = $1 AND date = $2`,
          [userId, date]
        );
      }

      // Upsert each entry
      for (const [metricId, value] of Object.entries(entries)) {
        if (value === '' || value === null || value === undefined) {
          await client.query(
            `DELETE FROM entries WHERE user_id = $1 AND metric_id = $2 AND date = $3`,
            [userId, metricId, date]
          );
        } else {
          await client.query(
            `INSERT INTO entries (user_id, metric_id, date, value)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, metric_id, date) DO UPDATE SET value = $4`,
            [userId, metricId, date, String(value)]
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

  async upsertBulk(userId: string, entriesMap: EntriesMap): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [date, dayEntries] of Object.entries(entriesMap)) {
        for (const [metricId, value] of Object.entries(dayEntries)) {
          if (value === '' || value === null || value === undefined) {
            await client.query(
              `DELETE FROM entries WHERE user_id = $1 AND metric_id = $2 AND date = $3`,
              [userId, metricId, date]
            );
          } else {
            await client.query(
              `INSERT INTO entries (user_id, metric_id, date, value)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id, metric_id, date) DO UPDATE SET value = $4`,
              [userId, metricId, date, String(value)]
            );
          }
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
};
