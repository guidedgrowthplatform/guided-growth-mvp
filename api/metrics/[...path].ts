import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from '../_lib/auth.js';
import { validateDate, validateUUID } from '../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  const user = await requireUser(req, res);
  if (!user) return;
  await setUserContext(user.id);

  const raw = req.query['...path'];
  let segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (segments[0] === '__index') segments = [];

  try {
    // GET /api/metrics — list all metrics
    if (segments.length === 0 && req.method === 'GET') {
      const result = await pool.query(
        `SELECT id, name, input_type, scale_min, scale_max, unit, target_value, sort_order, active, created_at
         FROM metrics WHERE user_id = $1 ORDER BY sort_order, created_at`,
        [user.id],
      );
      return res.json(result.rows);
    }

    // POST /api/metrics — create metric
    if (segments.length === 0 && req.method === 'POST') {
      const { name, input_type, scale_min, scale_max, unit, target_value } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }

      const result = await pool.query(
        `INSERT INTO metrics (user_id, name, input_type, scale_min, scale_max, unit, target_value, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         RETURNING id, name, input_type, scale_min, scale_max, unit, target_value, sort_order, active, created_at`,
        [
          user.id,
          name,
          input_type || 'numeric',
          scale_min || null,
          scale_max || null,
          unit || null,
          target_value || null,
        ],
      );

      return res.status(201).json(result.rows[0]);
    }

    if (segments.length === 0) {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const metricId = validateUUID(segments[0]);
    if (!metricId) {
      return res.status(400).json({ error: 'Invalid metric ID' });
    }

    // GET /api/metrics/{id} — get single metric
    if (segments.length === 1 && req.method === 'GET') {
      const result = await pool.query(
        `SELECT id, name, input_type, scale_min, scale_max, unit, target_value, sort_order, active, created_at
         FROM metrics WHERE id = $1 AND user_id = $2`,
        [metricId, user.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Metric not found' });
      }

      return res.json(result.rows[0]);
    }

    // PUT /api/metrics/{id} — update metric
    if (segments.length === 1 && req.method === 'PUT') {
      const { name, input_type, scale_min, scale_max, unit, target_value, active, sort_order } =
        req.body;

      const result = await pool.query(
        `UPDATE metrics
         SET name = COALESCE($3, name),
             input_type = COALESCE($4, input_type),
             scale_min = COALESCE($5, scale_min),
             scale_max = COALESCE($6, scale_max),
             unit = COALESCE($7, unit),
             target_value = COALESCE($8, target_value),
             active = COALESCE($9, active),
             sort_order = COALESCE($10, sort_order)
         WHERE id = $1 AND user_id = $2
         RETURNING id, name, input_type, scale_min, scale_max, unit, target_value, sort_order, active, created_at`,
        [
          metricId,
          user.id,
          name,
          input_type,
          scale_min,
          scale_max,
          unit,
          target_value,
          active,
          sort_order,
        ],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Metric not found' });
      }

      return res.json(result.rows[0]);
    }

    // DELETE /api/metrics/{id} — soft delete via active flag
    if (segments.length === 1 && req.method === 'DELETE') {
      const result = await pool.query(
        `UPDATE metrics SET active = false WHERE id = $1 AND user_id = $2 RETURNING id`,
        [metricId, user.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Metric not found' });
      }

      return res.json({ message: 'Metric deleted' });
    }

    // GET /api/metrics/{id}/entries — list entries for metric (with optional date range)
    if (segments.length === 2 && segments[1] === 'entries' && req.method === 'GET') {
      const rawStart = req.query.start_date;
      const rawEnd = req.query.end_date;
      const startDate = rawStart != null ? validateDate(rawStart) : null;
      const endDate = rawEnd != null ? validateDate(rawEnd) : null;
      if (rawStart != null && !startDate) {
        return res.status(400).json({ error: 'Invalid start_date (YYYY-MM-DD)' });
      }
      if (rawEnd != null && !endDate) {
        return res.status(400).json({ error: 'Invalid end_date (YYYY-MM-DD)' });
      }

      let query = `SELECT id, metric_id, date, value, logged_at
                   FROM metric_entries
                   WHERE metric_id = $1 AND user_id = $2`;
      const params: unknown[] = [metricId, user.id];

      if (startDate) {
        query += ` AND date >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND date <= $${params.length + 1}`;
        params.push(endDate);
      }

      query += ` ORDER BY date DESC`;

      const result = await pool.query(query, params);
      return res.json(result.rows);
    }

    // POST /api/metrics/{id}/entries — create or upsert entry
    if (segments.length === 2 && segments[1] === 'entries' && req.method === 'POST') {
      const { date, value } = req.body;
      const validDate = validateDate(date);
      if (!validDate) {
        return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
      }
      if (value == null || value === '') {
        return res.status(400).json({ error: 'value is required' });
      }

      const result = await pool.query(
        `INSERT INTO metric_entries (user_id, metric_id, date, value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (metric_id, date) DO UPDATE SET value = $4, logged_at = now()
         RETURNING id, metric_id, date, value, logged_at`,
        [user.id, metricId, validDate, String(value)],
      );

      return res.json(result.rows[0]);
    }

    // PUT /api/metrics/{id}/entries/{date} — update entry
    if (segments.length === 3 && segments[1] === 'entries' && req.method === 'PUT') {
      const entryDate = validateDate(segments[2]);
      if (!entryDate) {
        return res.status(400).json({ error: 'Invalid entry date (YYYY-MM-DD)' });
      }
      const { value } = req.body;
      if (value == null || value === '') {
        return res.status(400).json({ error: 'value is required' });
      }

      const result = await pool.query(
        `UPDATE metric_entries SET value = $4, logged_at = now()
         WHERE metric_id = $1 AND user_id = $2 AND date = $3
         RETURNING id, metric_id, date, value, logged_at`,
        [metricId, user.id, entryDate, String(value)],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      return res.json(result.rows[0]);
    }

    // DELETE /api/metrics/{id}/entries/{date} — delete entry
    if (segments.length === 3 && segments[1] === 'entries' && req.method === 'DELETE') {
      const entryDate = validateDate(segments[2]);
      if (!entryDate) {
        return res.status(400).json({ error: 'Invalid entry date (YYYY-MM-DD)' });
      }

      const result = await pool.query(
        `DELETE FROM metric_entries
         WHERE metric_id = $1 AND user_id = $2 AND date = $3
         RETURNING id`,
        [metricId, user.id, entryDate],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      return res.json({ message: 'Entry deleted' });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('Metrics handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
