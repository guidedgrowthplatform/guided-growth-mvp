import express from 'express'
import pool from '../db/index.js'
import { requireAuth, requireActiveUser, requireOwnership } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(requireAuth, requireActiveUser)

// List user's reports
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, content, created_at, updated_at
       FROM reports
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    )
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' })
  }
})

// Get single report
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch report' })
  }
})

// Create report
router.post('/', async (req, res) => {
  try {
    const { title, content } = req.body

    if (!title) {
      return res.status(400).json({ error: 'Title is required' })
    }

    const result = await pool.query(
      `INSERT INTO reports (user_id, title, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, title, content || null]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: 'Failed to create report' })
  }
})

// Update report
router.patch('/:id', async (req, res) => {
  try {
    const { title, content } = req.body
    const { id } = req.params

    const result = await pool.query(
      `UPDATE reports
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [title, content, id, req.user.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: 'Failed to update report' })
  }
})

// Delete report
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM reports WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' })
    }

    res.json({ message: 'Report deleted' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete report' })
  }
})

export default router


