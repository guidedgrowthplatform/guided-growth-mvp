import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireAdmin, handlePreflight } from '../_lib/auth.js';

async function logAuditAction(
  adminUserId: string,
  action: string,
  targetType: string,
  targetIdentifier: string | null,
  payload: Record<string, unknown> | null,
) {
  await pool.query(
    'INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_identifier, payload_json) VALUES ($1, $2, $3, $4, $5)',
    [adminUserId, action, targetType, targetIdentifier, payload ? JSON.stringify(payload) : null],
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  const user = await requireAdmin(req, res);
  if (!user) return;

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  // /api/admin/users and /api/admin/users/:id/...
  if (route === 'users') {
    const userId = segments[1];
    const subRoute = segments[2];

    // /api/admin/users/:id/role
    if (userId && subRoute === 'role' && req.method === 'PATCH') {
      const { role } = req.body;
      if (!role || !['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin".' });
      }
      const result = await pool.query(
        `UPDATE profiles SET role = $1 WHERE id = $2
         RETURNING id, role, status, name, image,
                   (SELECT email FROM auth.users WHERE id = profiles.id) as email,
                   (SELECT created_at FROM auth.users WHERE id = profiles.id) as created_at`,
        [role, userId],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      await logAuditAction(user.id, 'update_role', 'user', userId, { role });
      return res.json(result.rows[0]);
    }

    // /api/admin/users/:id/status
    if (userId && subRoute === 'status' && req.method === 'PATCH') {
      const { status } = req.body;
      if (!status || !['active', 'disabled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be "active" or "disabled".' });
      }
      const result = await pool.query(
        `UPDATE profiles SET status = $1 WHERE id = $2
         RETURNING id, role, status, name, image,
                   (SELECT email FROM auth.users WHERE id = profiles.id) as email,
                   (SELECT created_at FROM auth.users WHERE id = profiles.id) as created_at`,
        [status, userId],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      await logAuditAction(user.id, 'update_status', 'user', userId, { status });
      return res.json(result.rows[0]);
    }

    // /api/admin/users/:id/data
    if (userId && subRoute === 'data' && req.method === 'GET') {
      const [metrics, entries, reflections] = await Promise.all([
        pool.query('SELECT COUNT(*)::int as count FROM metrics WHERE user_id = $1', [userId]),
        pool.query('SELECT COUNT(*)::int as count FROM entries WHERE user_id = $1', [userId]),
        pool.query('SELECT COUNT(*)::int as count FROM reflections WHERE user_id = $1', [userId]),
      ]);
      return res.json({
        user_id: userId,
        metrics: metrics.rows[0].count,
        entries: entries.rows[0].count,
        reflections: reflections.rows[0].count,
      });
    }

    // /api/admin/users (list all)
    if (!userId && req.method === 'GET') {
      const result = await pool.query(
        `SELECT au.id, au.email, p.name, p.image, p.role, p.status, au.created_at
         FROM auth.users au
         LEFT JOIN profiles p ON p.id = au.id
         ORDER BY au.created_at DESC`,
      );
      return res.json(result.rows);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  // /api/admin/allowlist
  if (route === 'allowlist') {
    if (req.method === 'GET') {
      const result = await pool.query(
        `SELECT a.*, au.email as added_by_email FROM allowlist a LEFT JOIN auth.users au ON a.added_by_user_id = au.id ORDER BY a.created_at DESC`,
      );
      return res.json(result.rows);
    }
    if (req.method === 'POST') {
      const { email, note } = req.body;
      if (!email?.includes('@')) return res.status(400).json({ error: 'Valid email required' });
      const exists = await pool.query('SELECT id FROM allowlist WHERE email = $1', [email]);
      if (exists.rows.length > 0) return res.status(409).json({ error: 'Already in allowlist' });
      const result = await pool.query(
        'INSERT INTO allowlist (email, added_by_user_id, note) VALUES ($1, $2, $3) RETURNING *',
        [email, user.id, note || null],
      );
      await logAuditAction(user.id, 'add_allowlist', 'allowlist', email, { note: note || null });
      return res.status(201).json(result.rows[0]);
    }
    if (req.method === 'DELETE') {
      const id = segments[1];
      if (!id) return res.status(400).json({ error: 'ID required' });
      const result = await pool.query('DELETE FROM allowlist WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      await logAuditAction(user.id, 'remove_allowlist', 'allowlist', result.rows[0].email, null);
      return res.json({ message: 'Removed' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // /api/admin/audit-log
  if (route === 'audit-log') {
    if (req.method === 'GET') {
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await pool.query(
        `SELECT a.*, au.email as admin_email FROM admin_audit_log a LEFT JOIN auth.users au ON a.admin_user_id = au.id ORDER BY a.created_at DESC LIMIT $1`,
        [limit],
      );
      return res.json(result.rows);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.status(404).json({ error: 'Not found' });
}
