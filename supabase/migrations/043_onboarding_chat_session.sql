-- Server-authoritative onboarding chat session id so conversational memory
-- (OpenAI previous_response_id chain, keyed by chat_session_id) survives a
-- pause/return within the same identity instead of dying on tab close.
ALTER TABLE onboarding_states ADD COLUMN IF NOT EXISTS chat_session_id UUID;
