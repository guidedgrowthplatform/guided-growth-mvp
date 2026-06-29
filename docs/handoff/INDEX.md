# Handoff docs index

The single entry point for any Claude session working in this repo. If you are picking up a workstream cold, start here.

## How to use this

1. Read this index to see what handoffs are active.
2. Find the row whose `topic-slug` matches your workstream.
3. Open that file and read it in full before touching any code. Each handoff is the authoritative current state for its branch.

If your work does not match any active handoff, you are likely starting something new. Create a new handoff (see "How to add a handoff" below) so the next session is not stranded.

## Active handoffs

One line each: `topic-slug` -> file -> one-line current state.

- `path3-chat` -> [path3-chat.md](path3-chat.md) -> Path 3 text chat hardening plus text-driven onboarding (sequential collection, client-owned advancement); core work committed, post-commit fixes were uncommitted at last write, flags an onboarding state-machine refactor as the recommended next step.
- `onboarding-engine` -> [onboarding-engine.md](onboarding-engine.md) -> The canonical chat-native onboarding engine (orchestrator, renderer, 12 beats, voice cascade, auth-in-flow, flow-builder bridge) on branch `onboarding-unified-engine`, MR !361; flag-gated, not live by default.
- `dual-app` -> [dual-app.md](dual-app.md) -> Two installable apps side by side (stable for real use, QA for breaking things), distinguished by app id, name, and icon; branch `feat/dual-app-stable-qa`, MR !273; code and assets done, ships after account-level prerequisites and the staging-Supabase split.

## How to add a handoff

1. Copy [TEMPLATE.md](TEMPLATE.md) to a new file named after your workstream, not your branch: `docs/handoff/<topic-slug>.md`. Use a short kebab-case noun phrase (for example `vapi-integration`, `qa-flow-picker`). Branch names come and go; topic slugs stay greppable.
2. One new file per handoff. Do not append to someone else's file. Separate files mean parallel sessions never clash and the index stays the merge point.
3. Add a one-line row to the "Active handoffs" list above pointing at your new file with a one-line current-state summary.
4. Keep your handoff current as the work moves. The index summary should always reflect the latest state at a glance.

When a workstream is finished or abandoned, move its row to the "Retired" section below (and note the date or final state) rather than deleting it, so the trail stays auditable.

## Retired

_(none yet)_
