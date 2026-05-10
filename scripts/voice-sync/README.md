# scripts/voice-sync

Two scripts share this directory:

| File | Purpose |
|---|---|
| `seed_contexts.py` | **(P1-03)** Sync `Screens` tab → Supabase `screen_contexts`. Idempotent. The LLM reads from there on every `callLLM()`. |
| `sync.py` | **(legacy)** Generates pre-recorded MP3s from the `Voice System` tab via Cartesia TTS. Predates the Vapi pivot; will likely retire. |
| `test-sheet.py` | One-shot Sheets API connection check. |

This README covers `seed_contexts.py`. See the file headers for the others.

## Local setup (one-time)

```bash
cd scripts/voice-sync
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Drop the rotated GCP service-account JSON at the project root:
#   ~/Documents/Upwork/YA/guided-growth-mvp/service-account.json
# (gitignored already — never commit)

# Local env (gitignored):
cp .env.example .env
# Edit .env: paste SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
```

The service-account email needs **Viewer** access on the Voice Journey sheet. That email is in the JSON's `client_email` field.

## Running it

```bash
cd scripts/voice-sync
source .venv/bin/activate

# Full sync — read sheet, diff against DB, upsert changes.
python seed_contexts.py

# Dry run — read + compute diff, no DB writes.
python seed_contexts.py --dry-run

# One-screen iteration (fast).
python seed_contexts.py --screen-id ONBOARD-BEGINNER-03

# Hard-delete orphans (manual cleanup; cron never does this).
python seed_contexts.py --prune
```

Output ends with:

```
screens_scanned=N seedable=N inserted=N updated=N noop=N pruned=N skipped=N
```

`noop` = row's hash matches what's in DB → no write.

## Running unit tests

```bash
source .venv/bin/activate
pytest tests/
```

Pure-function tests for `lib.transform` and `lib.hashing` — no network, no DB.

## CI (GitLab)

`.gitlab-ci.yml` defines the `voice-sync` job. It runs on:

- **Schedule** — set up via GitLab UI (Settings → CI/CD → Schedules → New schedule). Recommend `*/15 * * * *`.
- **Manual via UI** — Pipelines → Run pipeline → branch + variables.
- **Trigger token / API** — used by Phase 2 Apps Script `onEdit` to POST a pipeline trigger.

GitLab CI variables (Settings → CI/CD → Variables):

| Name | Type | Masked | Protected | Notes |
|---|---|---|---|---|
| `GCP_SA_KEY` | **File** | n/a | yes | Paste full service-account JSON as the value. GitLab writes it to disk at runtime and sets `$GCP_SA_KEY` to the file path. The job exports it as `GOOGLE_APPLICATION_CREDENTIALS`. |
| `GOOGLE_SHEET_ID` | Variable | no | no | Sheet ID from the URL. |
| `SUPABASE_URL` | Variable | no | yes | Same value as in Vercel. |
| `SUPABASE_SERVICE_ROLE_KEY` | Variable | yes | yes | Service-role key. Mask it. |

Why `File` type for the service-account JSON: multi-line JSON can't be masked as a regular variable in GitLab. File type is the safe pattern.

> ⚠️ **GitLab CI minutes**: per task P1-01 the team's GitLab runner quota was exhausted; jobs may queue without running until quota is restored or P1-01 ships (move to GitHub Actions). Until then, run the script locally — see "Running it" above.

## How it stays idempotent

For each `Row Type == "Screen"` row, the script:

1. Extracts the canonical source columns into a stable-order dict.
2. Computes `sha256(canonical_json)` of that dict.
3. Reads the existing `content_hash` for `screen_id` from `screen_contexts`.
4. If they match — `noop`, no write.
5. If they differ — upsert with `version + 1`, `updated_at = NOW()`.

Re-running with no sheet changes makes zero DB writes.

## What it skips

| Condition | Behavior |
|---|---|
| `Row Type != "Screen"` | Silent — that row isn't in scope. |
| Empty `Screen ID` | Logged warning to stderr, row skipped. |
| Empty `AI Context Block` | Logged warning to stderr, row skipped (Yair hasn't authored content yet). |
| Duplicate `Screen ID` | First occurrence wins; second logged as duplicate-skip. |
| Removed from sheet | Existing row in `screen_contexts` is **kept** (avoids breaking in-flight LLM sessions). Use `--prune` for explicit cleanup. |

Skipped rows return exit code 0 — they're warnings, not failures. Hard failures (auth, network, DB) return non-zero.

## Pointers

- Plan: `~/.claude/plans/okay-let-s-plan-on-luminous-frog.md`
- Context-block format: see plan, section "Exact `context_block` format"
- Migration: `supabase/migrations/016_screen_contexts_and_session_log.sql`
- Source-of-truth sheet: <https://docs.google.com/spreadsheets/d/1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw/edit>
