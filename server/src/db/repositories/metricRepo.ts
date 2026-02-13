import pool from '../pool';
import type { Metric, MetricCreate, MetricUpdate } from '../../../../packages/shared/src/types';

export const metricRepo = {
  async findByUserId(userId: string): Promise<Metric[]> {
    const result = await pool.query(
      `SELECT * FROM metrics WHERE user_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [userId]
    );
    return result.rows;
  },

  async findById(id: string, userId: string): Promise<Metric | null> {
    const result = await pool.query(
      `SELECT * FROM metrics WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return result.rows[0] || null;
  },

  async create(userId: string, data: MetricCreate): Promise<Metric> {
    // Get next sort_order
    const orderResult = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM metrics WHERE user_id = $1`,
      [userId]
    );
    const sortOrder = orderResult.rows[0].next_order;

    const result = await pool.query(
      `INSERT INTO metrics (user_id, name, input_type, question, active, frequency, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, data.name, data.input_type, data.question, data.active ?? true, data.frequency, sortOrder]
    );
    return result.rows[0];
  },

  async update(id: string, userId: string, data: MetricUpdate): Promise<Metric | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (data.name !== undefined) { fields.push(`name = $${paramIdx++}`); values.push(data.name); }
    if (data.input_type !== undefined) { fields.push(`input_type = $${paramIdx++}`); values.push(data.input_type); }
    if (data.question !== undefined) { fields.push(`question = $${paramIdx++}`); values.push(data.question); }
    if (data.active !== undefined) { fields.push(`active = $${paramIdx++}`); values.push(data.active); }
    if (data.frequency !== undefined) { fields.push(`frequency = $${paramIdx++}`); values.push(data.frequency); }

    if (fields.length === 0) return this.findById(id, userId);

    values.push(id, userId);
    const result = await pool.query(
      `UPDATE metrics SET ${fields.join(', ')} WHERE id = $${paramIdx++} AND user_id = $${paramIdx}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM metrics WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async reorder(userId: string, metricIds: string[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < metricIds.length; i++) {
        await client.query(
          `UPDATE metrics SET sort_order = $1 WHERE id = $2 AND user_id = $3`,
          [i, metricIds[i], userId]
        );
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
