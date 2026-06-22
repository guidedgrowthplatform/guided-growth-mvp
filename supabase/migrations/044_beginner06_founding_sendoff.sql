-- 044_beginner06_founding_sendoff.sql
--
-- Replaces the generic "Good luck — you've got this" onboarding send-off on
-- ONBOARD-BEGINNER-06 (Plan Review, final screen) with the spec's "Founding
-- User Moment" closing — phase-1 ONBOARD-BEGINNER-10: ownership transfer,
-- "this is your system now", not a generic well-wish. The coach speaks this
-- line right before confirm_plan; runtime reads it from screen_contexts.
--
-- Surgical replace() on the existing row so we don't re-embed the whole block.
-- STOPGAP: the durable source of truth is the Master Sheet (Screens tab) synced
-- via scripts/voice-sync/seed_contexts.py — mirror this copy there or the next
-- sync reverts it. No-op if the row is absent. Idempotent (re-running finds no
-- old text to replace).
--
-- NOT YET APPLIED — pending review/approval.

BEGIN;

UPDATE screen_contexts
SET
  context_block = replace(
    replace(
      context_block,
      $old1$  - "Good luck — you've got this."
  - "You're all set. See you on the home screen."
  - "Have a good one — talk soon."$old1$,
      $new1$  - "You're in, [Name]. This is your system now — your first check-in's waiting on the home screen. Talk soon."
  - "That's your foundation set, [Name]. Show up, and we'll grow it together. Talk soon."
  - "You're all set, [Name]. Your first check-in's on the home screen — talk to you soon."$new1$
    ),
    $old2$speak ONE short send-off ("Good luck — you've got this."), then [confirm_plan]$old2$,
    $new2$speak ONE short send-off ("You're in, [Name] — this is your system now. Talk soon."), then [confirm_plan]$new2$
  ),
  content_hash = 'migration-044-sendoff-override',
  updated_at = now()
WHERE screen_id = 'ONBOARD-BEGINNER-06';

COMMIT;
