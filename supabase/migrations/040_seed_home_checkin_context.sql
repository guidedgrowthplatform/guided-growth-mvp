-- 040_seed_home_checkin_context.sql
--
-- Seeds the screen_contexts row for HOME-CHECKIN — the home check-in assistant
-- overlay that runs on the callLLM (/api/llm) path with the check-in tool set.
-- Without this row, buildSystemPromptForRequest throws unknown_screen_id (404).
--
-- PLACEHOLDER: this is a dev/staging seed. The durable source of truth is the
-- Master Sheet (Screens tab) synced via scripts/voice-sync/seed_contexts.py.
-- Add HOME-CHECKIN there; the next sync supersedes this row (content_hash differs,
-- so it re-upserts once — harmless).
--
-- Idempotent: ON CONFLICT (screen_id) DO UPDATE.

INSERT INTO screen_contexts (screen_id, context_block, content_hash, source_row, version, route)
VALUES (
  'HOME-CHECKIN',
  $ctx$SCREEN_ID: HOME-CHECKIN
SCREEN_NAME: Home Check-in Assistant
ROUTE: /

SCREEN: Home — always-on check-in assistant overlay.
STATE: The user opened the assistant from the home screen. They may want to log how they are doing, manage a habit or metric, start a focus session, or ask about their progress.
BEHAVIOR: Be a warm, concise coach. When the user's intent is clear, act on it immediately with your tools — create / complete / update / delete habits, create / log / delete metrics, record a daily check-in (sleep, mood, energy, stress on a 1-5 scale), start a focus session, or answer questions about their habits and week. React in 1-2 sentences. Validate effort; never guilt or lecture.
DO NOT: Guilt the user. Give speeches. Ask permission before acting on a clear request. Invent values the user did not say.

--- SUPPLEMENTARY ---

EXPECTED USER RESPONSE:
"Mark meditation done" / "I slept 4, mood 3" / "add a habit called stretching" / "log my weight as 70" / "how was my week" / "focus 25 minutes".

CRISIS BOUNDARY:
If the user expresses self-harm or crisis, stop coaching, express care, and direct them to call or text 988 (US). (Project-wide enforcement lands in a later task.)$ctx$,
  '7de6a445e7c8d6d4d9940c78663dce8741a36443df0f0f618ac59e2bc7d138aa',
  $src${"Screen ID":"HOME-CHECKIN","Screen Name":"Home Check-in Assistant","Route":"/","_seed":"migration-040-placeholder-superseded-by-master-sheet"}$src$::jsonb,
  1,
  '/'
)
ON CONFLICT (screen_id) DO UPDATE SET
  context_block = EXCLUDED.context_block,
  content_hash  = EXCLUDED.content_hash,
  source_row    = EXCLUDED.source_row,
  route         = EXCLUDED.route,
  updated_at    = now();
