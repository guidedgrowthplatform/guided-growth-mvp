-- The Screens sheet maps SPLASH to "/" and HOME-* to "/home", but the
-- React Router serves SplashScreenPage at "/splash" and HomePage at "/"
-- (via <Route index>). "/home" is a legacy alias. Without this fix, every
-- landing at "/" was logged as SPLASH and home navigations confused both
-- screens.
--
-- Mirrors ROUTE_OVERRIDES in scripts/voice-sync/lib/transform.py — keep both
-- in sync when changing routes. source_row JSONB is intentionally NOT updated
-- so content_hash stays stable and the seeder doesn't bump version numbers.

UPDATE screen_contexts
SET route = '/splash'
WHERE screen_id = 'SPLASH' AND source_row->>'Route' = '/';

UPDATE screen_contexts
SET route = '/'
WHERE source_row->>'Route' = '/home';
