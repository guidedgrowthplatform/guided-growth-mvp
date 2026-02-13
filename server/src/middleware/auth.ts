import type { Request, Response, NextFunction } from 'express';
import pool from '../db/pool.js';
import type { User } from '@life-growth-tracker/shared';

// Extend Express Request with user
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string | null;
      avatar_url: string | null;
      role: string;
      status: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

export async function requireActiveUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const result = await pool.query('SELECT status FROM users WHERE id = $1', [req.user.id]);

  if (result.rows.length === 0) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  if (result.rows[0].status !== 'active') {
    res.status(403).json({ error: 'Account is disabled' });
    return;
  }

  next();
}
