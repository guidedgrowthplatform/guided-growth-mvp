# voice-sync Apps Script trigger

Installable Google Apps Script that fires a GitHub `repository_dispatch` whenever
the `Screens` tab of the Voice Journey sheet is edited. The workflow
(`.github/workflows/voice-sync.yml`) is the listener; this script is the producer.

A trailing 30 s debounce coalesces bursts of edits down to a single dispatch.
A daily 06:00 UTC cron in the workflow is the safety net if this script ever
goes dark (PAT expired, project disabled, quota exhausted).

## Files

- `Code.gs` — the handler. Two functions are wired up: `onChangeHandler`
  (the installable trigger) and `firePending_` (the time-based one-shot that
  actually POSTs to GitHub).
- `appsscript.json` — manifest. Declares the three OAuth scopes the script
  needs: external request, ScriptApp (to manage its own triggers), and
  `spreadsheets.currentonly`.

The committed copy here is the source of truth. The Sheet's Apps Script project
is operated manually — re-paste if it ever needs to be rebuilt.

## Caveats

- **Default-branch requirement** — `repository_dispatch` only fires workflows
  that live on the GitHub repo's default branch (`main`). Until this change is
  merged to `main`, the dispatch path is a no-op. Test via `workflow_dispatch`
  in the Actions tab in the meantime.
- **Active-sheet filter** — `onChange` event objects don't tell us which sheet
  was edited, so the handler filters via `getActiveSheet().getName()`. For
  human edits via the Sheets UI this is reliable (you can only edit the tab
  you're viewing). Programmatic edits via Sheets API or another Apps Script
  can fool this filter — they're not part of this sheet's workflow today, but
  worth knowing if that ever changes.

## One-time install

1. Open the Voice Journey sheet
   (`https://docs.google.com/spreadsheets/d/1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw/edit`).
2. `Extensions → Apps Script`. A new project opens.
3. Replace the default `Code.gs` with this folder's `Code.gs`. Show
   `appsscript.json` via `Project Settings → "Show appsscript.json manifest file
   in editor"` and replace its contents too.
4. `Project Settings → Script properties`, add:
   - `GITHUB_REPO` → `guidedgrowthplatform/guided-growth-mvp`
   - `GITHUB_PAT`  → a fine-grained PAT (see below)
   - `DEBOUNCE_MS` → optional, defaults to `30000`
5. `Triggers → + Add Trigger`:
   - Function: `onChangeHandler`
   - Deployment: `Head`
   - Event source: `From spreadsheet`
   - Event type: `On change`
   - Save. Google will prompt for authorization on the three scopes — approve.

## Fine-grained PAT

Generate at `github.com/settings/personal-access-tokens/new`:

- Resource owner: `guidedgrowthplatform`
- Repository access: only `guided-growth-mvp`
- Permissions → Repository permissions → **Actions: Read and write** (this is
  the only one needed to fire `repository_dispatch`)
- Expiration: 90 days

Paste it into the `GITHUB_PAT` script property. Rotation: regenerate the PAT
in GitHub, update the script property — no redeploy.

## Verifying

- Apps Script side: `Executions` tab in the Apps Script editor shows each
  `onChangeHandler` and `firePending_` run. Successful dispatch logs nothing;
  failures log `voice-sync dispatch failed <code>: <body>` to console.
- GitHub side: `Actions → voice-sync` should show a run with
  `event_name=repository_dispatch` within ~35 s of an edit.
- Supabase side: `select * from voice_sync_health order by ran_at desc limit 5`
  shows recent run telemetry (trigger source + counts).

## Debounce mechanics

`onChangeHandler` fires on each save batch (Google batches keystrokes server-side
in ~3–5 s windows). For each fire it deletes any pending `firePending_` time-based
trigger and schedules a new one `DEBOUNCE_MS` out. The latest edit wins; the
trigger fires once, ~30 s after the last edit settles.

Time-based one-shots are durable on Google's side — if the Apps Script project
restarts between schedule and fire, the trigger still runs.

## When it breaks

The daily cron is the safety net. Symptoms and where to look:

| Symptom | Where |
|---|---|
| Sheet edited > 1 min ago, no workflow run | Apps Script Executions log |
| Executions log shows 401 from dispatch | PAT expired — regenerate & paste |
| Executions log shows 404 | `GITHUB_REPO` typo in script property |
| Executions show "Authorization required" | Trigger lost its OAuth grant — re-add the trigger |
| `voice_sync_health` has no rows for 24 h+ | Workflow itself isn't running; check `Actions` tab |
