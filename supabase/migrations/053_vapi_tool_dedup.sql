-- Idempotency ledger for Vapi tool-call webhooks.
--
-- Vapi retries webhooks on timeout / non-2xx. Without dedup a retry re-runs
-- non-idempotent handlers — most dangerously navigate_next, which bare-sets
-- current_step and can force a user BACKWARD a screen. Keyed on Vapi's
-- toolCall.id. `result` stores the prior outcome envelope ({result|error}) so a
-- replay returns the same ack instead of re-executing the write.
--
-- Service-role only (same trust model as onboarding_states — see CLAUDE.md
-- "RLS Policies Are NOT Functional"); no RLS policy needed.
CREATE TABLE IF NOT EXISTS vapi_tool_calls (
  tool_call_id TEXT PRIMARY KEY,
  anon_id      TEXT,
  tool         TEXT NOT NULL,
  result       JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supports a periodic retention sweep (onboarding tool calls are short-lived).
CREATE INDEX IF NOT EXISTS idx_vapi_tool_calls_created_at ON vapi_tool_calls (created_at);
