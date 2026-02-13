import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { adminRepo } from '../db/repositories/adminRepo';
import logger from '../middleware/logging';

const router = Router();
router.use(requireAuth, requireAdmin);

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await adminRepo.getAllUsers();
    res.json(users);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:userId/role
router.patch('/users/:userId/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }
    const user = await adminRepo.updateUserRole(req.params.userId, role);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    await adminRepo.logAction(req.user!.id, 'update_role', 'user', req.params.userId, { role });
    res.json(user);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// PATCH /api/admin/users/:userId/status
router.patch('/users/:userId/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'disabled'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const user = await adminRepo.updateUserStatus(req.params.userId, status);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    await adminRepo.logAction(req.user!.id, 'update_status', 'user', req.params.userId, { status });
    res.json(user);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// GET /api/admin/allowlist
router.get('/allowlist', async (_req, res) => {
  try {
    const allowlist = await adminRepo.getAllowlist();
    res.json(allowlist);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch allowlist' });
  }
});

// POST /api/admin/allowlist
router.post('/allowlist', async (req, res) => {
  try {
    const { email, note } = req.body;
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email required' });
      return;
    }
    const exists = await adminRepo.checkAllowlist(email);
    if (exists) {
      res.status(409).json({ error: 'Email already in allowlist' });
      return;
    }
    const entry = await adminRepo.addToAllowlist(email, req.user!.id, note);
    await adminRepo.logAction(req.user!.id, 'add_allowlist', 'allowlist', email, { note });
    res.status(201).json(entry);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to add to allowlist' });
  }
});

// DELETE /api/admin/allowlist/:id
router.delete('/allowlist/:id', async (req, res) => {
  try {
    const entry = await adminRepo.removeFromAllowlist(req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Allowlist entry not found' });
      return;
    }
    await adminRepo.logAction(req.user!.id, 'remove_allowlist', 'allowlist', entry.email);
    res.json({ message: 'Removed from allowlist' });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to remove from allowlist' });
  }
});

// GET /api/admin/audit-log
router.get('/audit-log', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const log = await adminRepo.getAuditLog(limit, offset);
    res.json(log);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// GET /api/admin/users/:userId/data
router.get('/users/:userId/data', async (req, res) => {
  try {
    const data = await adminRepo.getUserData(req.params.userId);
    res.json({ user_id: req.params.userId, ...data });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

export default router;
