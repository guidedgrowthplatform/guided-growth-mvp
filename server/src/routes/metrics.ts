import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { metricRepo } from '../db/repositories/metricRepo.js';
import { validateMetricCreate, validateMetricUpdate } from '@life-growth-tracker/shared';
import logger from '../middleware/logging.js';

const router = Router();
router.use(requireAuth);

// GET /api/metrics
router.get('/', async (req, res) => {
  try {
    const metrics = await metricRepo.findByUserId(req.user!.id);
    res.json(metrics);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// POST /api/metrics
router.post('/', validateBody(validateMetricCreate), async (req, res) => {
  try {
    const metric = await metricRepo.create(req.user!.id, req.body);
    res.status(201).json(metric);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to create metric' });
  }
});

// PATCH /api/metrics/:id
router.patch('/:id', validateBody(validateMetricUpdate), async (req, res) => {
  try {
    const metric = await metricRepo.update(req.params.id, req.user!.id, req.body);
    if (!metric) {
      res.status(404).json({ error: 'Metric not found' });
      return;
    }
    res.json(metric);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to update metric' });
  }
});

// DELETE /api/metrics/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await metricRepo.delete(req.params.id, req.user!.id);
    if (!deleted) {
      res.status(404).json({ error: 'Metric not found' });
      return;
    }
    res.json({ message: 'Metric deleted' });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to delete metric' });
  }
});

// PUT /api/metrics/reorder
router.put('/reorder', async (req, res) => {
  try {
    const { metric_ids } = req.body;
    if (!Array.isArray(metric_ids)) {
      res.status(400).json({ error: 'metric_ids array required' });
      return;
    }
    await metricRepo.reorder(req.user!.id, metric_ids);
    const metrics = await metricRepo.findByUserId(req.user!.id);
    res.json(metrics);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to reorder metrics' });
  }
});

export default router;
