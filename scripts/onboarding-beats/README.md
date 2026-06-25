# Onboarding beats pipeline

Design the onboarding coach's per-screen instructions ("beats") in a Google
Sheet, then migrate them into the app on a branch. Nothing here touches the live
app until you merge.

## The pieces

- **The beats Sheet** (source of truth for the beats): Google Sheet
  `1UqKXKjV2FKuIdBnwl1kPftIne1ksLxBs0C5y9E2jo80`, tab `Sheet1`.
  Column `Stage` holds `<SCREEN-ID>: <label>` (e.g. `ONBOARD-01--FORM: Profile Setup`).
  Column `Suggested` holds the beat text the coach should use.
  Row 1 is a `GLOBAL: The three paths` block (see "Open follow-up" below).
- **`apply_beats.py`**: reads the Sheet and rewrites the `context_block` for the
  matching screens in `src/generated/screen_contexts.json` — the bundle the app
  feeds to the coach (`src/lib/context/screenContextsBundle.ts`).

## Workflow

1. Edit the beats in the Sheet.
2. On a branch, run the command (see below).
3. Review the diff in `src/generated/screen_contexts.json`.
4. Test a preview build of the app and walk the onboarding flow.
5. Open an MR and merge to ship.

```bash
# Preview what would change, write nothing:
python scripts/onboarding-beats/apply_beats.py --dry-run

# Apply a single screen (recommended while iterating):
python scripts/onboarding-beats/apply_beats.py --only ONBOARD-01--FORM

# Apply every beat in the Sheet:
python scripts/onboarding-beats/apply_beats.py
```

## Auth

The command reads the Sheet with a Google service account that has Viewer access
to it. Credential file resolution order:

1. `--sa <path>`
2. `$GOOGLE_SERVICE_ACCOUNT`
3. `~/.config/guided-growth/service-account.json`
4. `./service-account.json` (repo root)

Default account: `voice-sync-reader@guided-growth-voice.iam.gserviceaccount.com`
(already granted Viewer on the beats Sheet).

## Why this is safe / how it differs from voice-sync

`scripts/voice-sync/` syncs the **App Master Sheet** to Supabase (and an hourly
GitHub Action ships that to the live app). This pipeline is separate: it reads a
**different** sheet (the beats Sheet) and only writes a **file in the repo**, so
you can iterate on a branch without anything reaching production. When you want
the beats to be the live coach text, you merge the branch.

## Open follow-up

- The `GLOBAL: The three paths` row defines what Path 1 / Path 2 / Path 3 mean.
  Each per-screen beat references those paths, and each beat also describes them
  inline, so a screen works on its own. To define them once for the whole coach,
  that block should land in the base system prompt (`api/_lib/llm/`), not the
  per-screen bundle. `apply_beats.py` skips it for now.
- `content_hash` here is a hash of the new `context_block` (these screens are now
  beats-owned). It is not consumed at runtime; the app reads `context_block`.
