-- Backfill screen_contexts.route with router-canonical paths.
-- Mirrors ROUTE_OVERRIDES in scripts/voice-sync/lib/transform.py — keep in sync.
-- Known collisions (tie-break: ORDER BY screen_id ASC):
--   /onboarding/step-7  ← /onboard/07 + /onboard/08 + /onboard/09
--   /                   ← SPLASH + HOME-* (resolved in 022)
-- source_row JSONB intentionally NOT updated — content_hash stays stable.

UPDATE screen_contexts SET route = CASE source_row->>'Route'
  WHEN '/auth/login'                    THEN '/login'
  WHEN '/auth/signup'                   THEN '/signup'
  WHEN '/onboard/preference'            THEN '/onboarding/voice-preference'
  WHEN '/onboard/mic'                   THEN '/onboarding/mic-permission'
  WHEN '/onboard/01'                    THEN '/onboarding/step-1'
  WHEN '/onboard/02'                    THEN '/onboarding/step-2'
  WHEN '/onboard/03'                    THEN '/onboarding/step-3'
  WHEN '/onboard/04'                    THEN '/onboarding/step-4'
  WHEN '/onboard/05'                    THEN '/onboarding/step-5'
  WHEN '/onboard/06'                    THEN '/onboarding/step-6'
  WHEN '/onboard/07'                    THEN '/onboarding/step-7'
  WHEN '/onboard/08'                    THEN '/onboarding/step-7'
  WHEN '/onboard/09'                    THEN '/onboarding/step-7'
  WHEN '/onboard/advanced/01'           THEN '/onboarding/advanced-input'
  WHEN '/onboard/advanced/02'           THEN '/onboarding/advanced-results'
  WHEN '/onboard/advanced'              THEN NULL
  WHEN '/onboard/beginner/05'           THEN NULL
  WHEN '/onboard/beginner/08'           THEN NULL
  WHEN '/onboard/beginner/09'           THEN NULL
  WHEN '/insights'                      THEN '/report'
  WHEN '/habits/create/template'        THEN '/add-habit'
  WHEN '/journal'                       THEN '/reflections'
  WHEN '/journal/freeform'              THEN NULL
  WHEN '/journal/guided'                THEN NULL
  WHEN '/journal/:id'                   THEN '/reflections/:id'
  WHEN '/habits/:id/reflection'         THEN '/habit/:habitId/reflection'
  WHEN '/habit/:id'                     THEN '/habit/:habitId'
  WHEN '/habit/:id/edit'                THEN NULL
  WHEN '/home (state: checkin-expanded)' THEN NULL
  WHEN '/home/reflection'               THEN NULL
  ELSE NULLIF(source_row->>'Route', '')
END;
