-- P1-40 support: surface the canonical `Route` from the Screens sheet as a
-- queryable column on screen_contexts. The data is already inside
-- source_row->>'Route' (extracted by scripts/voice-sync/seed_contexts.py); this
-- migration just promotes it to a real column so the frontend's navigate
-- auto-emitter can translate pathname → screen_id with one cached lookup.
--
-- Index is NON-UNIQUE on purpose: multiple screens share a route (e.g.
-- HOME-FIRST / HOME-MORNING / HOME-EVENING / HOME-RETURN all live at /home).
-- The frontend resolver returns the first match; per-screen code overrides by
-- passing screen_id explicitly to logEvent().

ALTER TABLE screen_contexts ADD COLUMN IF NOT EXISTS route TEXT;

CREATE INDEX IF NOT EXISTS screen_contexts_route_idx
  ON screen_contexts (route);

UPDATE screen_contexts
SET route = NULLIF(source_row->>'Route', '')
WHERE route IS NULL;
