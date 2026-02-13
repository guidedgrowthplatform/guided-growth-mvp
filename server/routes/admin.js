import express from 'express'
import pool from '../db/index.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import logger from '../middleware/logging.js'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()

// All admin routes require authentication and admin role
router.use(requireAuth, requireAdmin)

// Audit log helper
async function logAdminAction(adminUserId, action, targetType, targetIdentifier, payload = null) {
  try {
    await pool.query(
      `INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_identifier, payload_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminUserId, action, targetType, targetIdentifier, payload ? JSON.stringify(payload) : null]
    )
  } catch (error) {
    logger.error({ error: error.message, message: 'Failed to log admin action' })
  }
}

// Users management
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, avatar_url, role, status, created_at, updated_at, last_login_at
       FROM users
       ORDER BY created_at DESC`
    )
    res.json(result.rows)
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

router.patch('/users/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params
    const { role } = req.body

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    const result = await pool.query(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [role, userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    await logAdminAction(req.user.id, 'update_role', 'user', userId, { role })
    res.json(result.rows[0])
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Failed to update user role' })
  }
})

router.patch('/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params
    const { status } = req.body

    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const result = await pool.query(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    await logAdminAction(req.user.id, 'update_status', 'user', userId, { status })
    res.json(result.rows[0])
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Failed to update user status' })
  }
})

// Allowlist management
router.get('/allowlist', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.email as added_by_email
       FROM allowlist a
       LEFT JOIN users u ON a.added_by_user_id = u.id
       ORDER BY a.created_at DESC`
    )
    res.json(result.rows)
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Failed to fetch allowlist' })
  }
})

router.post('/allowlist', async (req, res) => {
  try {
    const { email, note } = req.body

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' })
    }

    // Check if already in allowlist
    const existing = await pool.query(
      'SELECT id FROM allowlist WHERE email = $1',
      [email]
    )

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in allowlist' })
    }

    const result = await pool.query(
      `INSERT INTO allowlist (email, added_by_user_id, note)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [email, req.user.id, note || null]
    )

    await logAdminAction(req.user.id, 'add_allowlist', 'allowlist', email, { note })
    res.status(201).json(result.rows[0])
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Failed to add to allowlist' })
  }
})

router.delete('/allowlist/:id', async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      'DELETE FROM allowlist WHERE id = $1 RETURNING *',
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Allowlist entry not found' })
    }

    await logAdminAction(req.user.id, 'remove_allowlist', 'allowlist', result.rows[0].email)
    res.json({ message: 'Removed from allowlist' })
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Failed to remove from allowlist' })
  }
})

// Audit log
router.get('/audit-log', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100
    const offset = parseInt(req.query.offset) || 0

    const result = await pool.query(
      `SELECT a.*, u.email as admin_email
       FROM admin_audit_log a
       JOIN users u ON a.admin_user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )
    res.json(result.rows)
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Failed to fetch audit log' })
  }
})

// User-owned data overview (example with reports)
router.get('/users/:userId/data', async (req, res) => {
  try {
    const { userId } = req.params

    // Check user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId])
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get report count
    const reportCount = await pool.query(
      'SELECT COUNT(*) as count FROM reports WHERE user_id = $1',
      [userId]
    )

    // Get recent reports
    const recentReports = await pool.query(
      `SELECT id, title, created_at
       FROM reports
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    )

    res.json({
      user_id: userId,
      reports: {
        total: parseInt(reportCount.rows[0].count),
        recent: recentReports.rows
      }
    })
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Failed to fetch user data' })
  }
})

export default router


