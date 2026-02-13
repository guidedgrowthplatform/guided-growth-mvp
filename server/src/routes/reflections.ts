import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { reflectionRepo } from '../db/repositories/reflectionRepo.js';
import { validateDateString, validateReflectionConfig } from '@life-growth-tracker/shared';
import logger from '../middleware/logging.js';

const router = Router();
router.use(requireAuth);

// GET /api/reflections/config
router.get('/config', async (req, res) => {
  try {
    const config = await reflectionRepo.getConfig(req.user!.id);
    res.json(config);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch reflection config' });
  }
});

// PUT /api/reflections/config
router.put('/config', async (req, res) => {
  try {
    if (!validateReflectionConfig(req.body)) {
      res.status(400).json({ error: 'Invalid reflection config' });
      return;
    }
    const config = await reflectionRepo.saveConfig(req.user!.id, req.body);
    res.json(config);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to save reflection config' });
  }
});

// GET /api/reflections?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!validateDateString(start) || !validateDateString(end)) {
      res.status(400).json({ error: 'start and end date params required (YYYY-MM-DD)' });
      return;
    }
    const reflections = await reflectionRepo.findByDateRange(req.user!.id, start, end);
    res.json(reflections);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch reflections' });
  }
});

// PUT /api/reflections/:date
router.put('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    if (!validateDateString(date)) {
      res.status(400).json({ error: 'Invalid date format (YYYY-MM-DD)' });
      return;
    }
    await reflectionRepo.upsertDay(req.user!.id, date, req.body);
    res.json({ message: 'Reflections saved' });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to save reflections' });
  }
});

// GET /api/affirmation
router.get('/affirmation', async (req, res) => {
  try {
    const value = await reflectionRepo.getAffirmation(req.user!.id);
    res.json({ value });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch affirmation' });
  }
});

// PUT /api/affirmation
router.put('/affirmation', async (req, res) => {
  try {
    const { value } = req.body;
    if (typeof value !== 'string') {
      res.status(400).json({ error: 'value string required' });
      return;
    }
    await reflectionRepo.saveAffirmation(req.user!.id, value);
    res.json({ value });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to save affirmation' });
  }
});

// GET /api/preferences
router.get('/preferences', async (req, res) => {
  try {
    const prefs = await reflectionRepo.getPreferences(req.user!.id);
    res.json(prefs);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// PUT /api/preferences
router.put('/preferences', async (req, res) => {
  try {
    const { default_view } = req.body;
    if (!['spreadsheet', 'form'].includes(default_view)) {
      res.status(400).json({ error: 'default_view must be spreadsheet or form' });
      return;
    }
    await reflectionRepo.savePreferences(req.user!.id, { default_view });
    res.json({ default_view });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

export default router;
