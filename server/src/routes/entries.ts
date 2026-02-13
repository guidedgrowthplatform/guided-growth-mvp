import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { entryRepo } from '../db/repositories/entryRepo';
import { validateDateString, validateDayEntries } from '../../../packages/shared/src/validation';
import logger from '../middleware/logging';

const router = Router();
router.use(requireAuth);

// GET /api/entries?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!validateDateString(start) || !validateDateString(end)) {
      res.status(400).json({ error: 'start and end date params required (YYYY-MM-DD)' });
      return;
    }
    const entries = await entryRepo.findByDateRange(req.user!.id, start, end);
    res.json(entries);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// PUT /api/entries/:date
router.put('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    if (!validateDateString(date)) {
      res.status(400).json({ error: 'Invalid date format (YYYY-MM-DD)' });
      return;
    }
    if (!validateDayEntries(req.body)) {
      res.status(400).json({ error: 'Body must be an object of { metric_id: value }' });
      return;
    }
    await entryRepo.upsertDay(req.user!.id, date, req.body);
    res.json({ message: 'Entries saved' });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to save entries' });
  }
});

// PUT /api/entries/bulk
router.put('/bulk', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: 'Body must be an object of { date: { metric_id: value } }' });
      return;
    }
    await entryRepo.upsertBulk(req.user!.id, req.body);
    res.json({ message: 'Bulk entries saved' });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to save bulk entries' });
  }
});

export default router;
