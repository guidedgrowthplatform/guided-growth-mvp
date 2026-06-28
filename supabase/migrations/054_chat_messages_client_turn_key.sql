-- Voice/Vapi transcript persistence.
-- The voice path UPSERTs a turn whose text grows across merged finals, so it needs
-- a stable idempotency key — but VoiceMessage ids ("vapi-user-<ts>") are not UUIDs
-- and can't be the PK. client_turn_key is that key; the partial unique lets the
-- append endpoint dedup/UPDATE per turn while the text path (NULL key) is untouched.
BEGIN;

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS client_turn_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_client_turn_key
  ON chat_messages (chat_session_id, client_turn_key)
  WHERE client_turn_key IS NOT NULL;

COMMIT;
