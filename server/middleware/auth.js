import pool from '../db/index.js'

export async function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  next()
}

export async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

export async function requireActiveUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  // Check if user is still active
  const result = await pool.query(
    'SELECT status FROM users WHERE id = $1',
    [req.user.id]
  )

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'User not found' })
  }

  if (result.rows[0].status !== 'active') {
    return res.status(403).json({ error: 'Account is disabled' })
  }

  next()
}

// Middleware to ensure user can only access their own data
export function requireOwnership(resourceUserId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const targetUserId = typeof resourceUserId === 'function' 
      ? resourceUserId(req) 
      : req.params.userId || req.body.user_id

    if (targetUserId && targetUserId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
    }

    next()
  }
}


