import pool from '../pool';
import type { User, AllowlistEntry, AuditLogEntry } from '../../../../packages/shared/src/types';

export const adminRepo = {
  async getAllUsers(): Promise<User[]> {
    const result = await pool.query(
      `SELECT id, email, name, avatar_url, role, status, created_at, updated_at, last_login_at
       FROM users ORDER BY created_at DESC`
    );
    return result.rows;
  },

  async updateUserRole(userId: string, role: string): Promise<User | null> {
    const result = await pool.query(
      `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [role, userId]
    );
    return result.rows[0] || null;
  },

  async updateUserStatus(userId: string, status: string): Promise<User | null> {
    const result = await pool.query(
      `UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, userId]
    );
    return result.rows[0] || null;
  },

  async getAllowlist(): Promise<AllowlistEntry[]> {
    const result = await pool.query(
      `SELECT a.*, u.email as added_by_email
       FROM allowlist a
       LEFT JOIN users u ON a.added_by_user_id = u.id
       ORDER BY a.created_at DESC`
    );
    return result.rows;
  },

  async addToAllowlist(email: string, addedByUserId: string, note?: string): Promise<AllowlistEntry> {
    const result = await pool.query(
      `INSERT INTO allowlist (email, added_by_user_id, note)
       VALUES ($1, $2, $3) RETURNING *`,
      [email, addedByUserId, note || null]
    );
    return result.rows[0];
  },

  async removeFromAllowlist(id: string): Promise<AllowlistEntry | null> {
    const result = await pool.query(
      `DELETE FROM allowlist WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  },

  async checkAllowlist(email: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT id FROM allowlist WHERE email = $1`,
      [email]
    );
    return result.rows.length > 0;
  },

  async getAuditLog(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
    const result = await pool.query(
      `SELECT a.*, u.email as admin_email
       FROM admin_audit_log a
       JOIN users u ON a.admin_user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  },

  async logAction(adminUserId: string, action: string, targetType: string, targetIdentifier: string | null, payload?: Record<string, unknown>): Promise<void> {
    await pool.query(
      `INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_identifier, payload_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminUserId, action, targetType, targetIdentifier, payload ? JSON.stringify(payload) : null]
    );
  },

  async getUserData(userId: string): Promise<{ metrics: number; entries: number; reflections: number }> {
    const [metricsRes, entriesRes, reflectionsRes] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM metrics WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*) as count FROM entries WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*) as count FROM reflections WHERE user_id = $1', [userId]),
    ]);
    return {
      metrics: parseInt(metricsRes.rows[0].count),
      entries: parseInt(entriesRes.rows[0].count),
      reflections: parseInt(reflectionsRes.rows[0].count),
    };
  },
};
