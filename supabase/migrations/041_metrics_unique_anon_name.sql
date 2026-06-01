-- 041_metrics_unique_anon_name.sql
--
-- Adds case-insensitive UNIQUE(anon_id, lower(name)) to metrics so concurrent
-- create_metric can't insert duplicates (user_habits got an exact-case equivalent
-- in 025; metrics was missed). lower(name) — not raw name — because the app dedups
-- with `name ILIKE` (findMetricByName), so an exact-case constraint wouldn't back
-- the rule the handler enforces. The createMetric handler also catches 23505 to
-- surface a clean message.
--
-- NOT YET APPLIED — pending review/approval.

BEGIN;

-- Surviving metric per (anon_id, lower(name)): earliest created_at, then id.
-- lower(name) collapses case-variant dups ("Weight"/"weight") the app treats as one.
CREATE TEMP TABLE metric_dedupe ON COMMIT DROP AS
SELECT
  id,
  first_value(id) OVER (
    PARTITION BY anon_id, lower(name) ORDER BY created_at, id
  ) AS keep_id
FROM metrics;

-- Move losers' entries onto the survivor for dates it lacks (one per date).
-- DISTINCT ON avoids in-statement (metric_id,date) collisions among losers;
-- ON CONFLICT skips dates the survivor already has.
INSERT INTO metric_entries (anon_id, metric_id, date, value, logged_at)
SELECT DISTINCT ON (d.keep_id, e.date)
  e.anon_id, d.keep_id, e.date, e.value, e.logged_at
FROM metric_entries e
JOIN metric_dedupe d ON e.metric_id = d.id
WHERE d.id <> d.keep_id
ORDER BY d.keep_id, e.date, e.logged_at DESC
ON CONFLICT (metric_id, date) DO NOTHING;

-- Drop losing metric rows; CASCADE removes their remaining (now-redundant) entries.
DELETE FROM metrics m
USING metric_dedupe d
WHERE m.id = d.id AND d.id <> d.keep_id;

-- Enforce case-insensitive uniqueness going forward. Unique index (not constraint)
-- because UNIQUE constraints can't span an expression. IF NOT EXISTS → re-run safe.
CREATE UNIQUE INDEX IF NOT EXISTS metrics_anon_lower_name_key
  ON metrics (anon_id, lower(name));

COMMIT;
