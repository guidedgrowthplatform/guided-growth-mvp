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

## Triggers

`.github/workflows/voice-sync.yml` is the listener. Two ways it fires today:

| Trigger | Cadence | Source |
|---|---|---|
| `schedule` | Hourly (at :00) | GitHub cron — the primary freshness mechanism |
| `workflow_dispatch` | On demand | Actions tab → "Run workflow" (supports the `dry_run` knob for diagnostics) |

Per-run cost is tiny because the script's per-row SHA256 hash short-circuits
when nothing has changed in the sheet — most hourly runs are pure no-ops
(~30 s of CI time each).

### How to verify it's working

1. `Actions → voice-sync` shows the most recent run; should appear hourly.
2. The step summary ends with the `screens_scanned=… inserted=… …` line.

GitHub Actions secrets used: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEET_ID`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

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
