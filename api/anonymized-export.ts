import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Anonymized Data Export API — MVP-19 (#43)
 *
 * GET /api/anonymized-export?type=habits|journal|checkins|users|all
 *
 * Returns anonymized data for admin analytics.
 * Requires ADMIN_API_KEY header for authentication.
 * Uses Supabase service role key to bypass RLS and read anonymized views.
 */

const VALID_TYPES = ['habits', 'journal', 'checkins', 'users', 'metrics', 'all'] as const;
type ExportType = typeof VALID_TYPES[number];

const VIEW_MAP: Record<Exclude<ExportType, 'all'>, string> = {
  habits: 'anonymized_habits',
  journal: 'anonymized_journal',
  checkins: 'anonymized_checkins',
  users: 'anonymized_users',
  metrics: 'anonymized_metrics',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── Auth: require admin API key ───
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return res.status(500).json({ error: 'ADMIN_API_KEY not configured on server' });
  }

  const providedKey = req.headers['x-admin-key'] || req.query.admin_key;
  if (providedKey !== adminKey) {
    return res.status(403).json({ error: 'Forbidden: invalid or missing admin key' });
  }

  // ─── Supabase service client (bypasses RLS) ───
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Supabase service credentials not configured' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ─── Parse export type ───
  const exportType = (req.query.type as string || 'all').toLowerCase() as ExportType;
  if (!VALID_TYPES.includes(exportType)) {
    return res.status(400).json({
      error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
    });
  }

  try {
    const result: Record<string, unknown[]> = {};
    const limit = Math.min(Number(req.query.limit) || 1000, 5000);

    if (exportType === 'all') {
      // Fetch all anonymized views
      for (const [key, view] of Object.entries(VIEW_MAP)) {
        const { data, error } = await supabase
          .from(view)
          .select('*')
          .limit(limit);

        if (error) {
          console.error(`Error fetching ${view}:`, error);
          result[key] = [];
        } else {
          result[key] = data || [];
        }
      }
    } else {
      const view = VIEW_MAP[exportType];
      const { data, error } = await supabase
        .from(view)
        .select('*')
        .limit(limit);

      if (error) {
        return res.status(502).json({ error: `Failed to fetch ${view}: ${error.message}` });
      }

      result[exportType] = data || [];
    }

    return res.status(200).json({
      exportedAt: new Date().toISOString(),
      type: exportType,
      anonymized: true,
      note: 'All personal identifiable information has been hashed with SHA-256. Mood, dates, frequencies, and stats are preserved for analytics.',
      data: result,
    });

  } catch (err) {
    console.error('Anonymized export error:', err);
    return res.status(500).json({
      error: `Server error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
