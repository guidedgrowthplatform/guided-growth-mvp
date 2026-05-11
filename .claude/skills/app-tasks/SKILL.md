---
name: app-tasks
description: Use when looking up engineering task IDs (P1-01 through P1-52, P2-01 through P2-14, P3-01..02), task status / acceptance criteria / detailed explanation, what's in progress vs blocked vs obsolete, which task builds a given screen, who owns what (Mint frontend, Yonas backend), or estimated hours for planning
user-invocable: false
---

# Tasks

Source: Google Sheet **Guided Growth OS App Master** · tab `Tasks` · gid `1687604173` · maintained by Mint (frontend) + Yonas (backend); Said transitioning out.

68 engineering tasks across Phase 1 / 2 / 3. First 8 columns match Alejandro's GitLab sync script for bidirectional sync (`Title`, `Description`, `Labels`, `Assignee`, `Status`, `Issue IID`, `URL`, `Last synced`).

## When to use
- Resolving any `P1-XX` / `P2-XX` / `P3-XX` ID.
- Need the full description / detailed explanation / acceptance criteria of a task.
- "What's in progress?" / "What's blocked?" — see status counts below.
- Planning estimate (hours), assignee, or workstream lookups.
- Cross-referenced from `app-screens` (`Tasks Ref` column).

## File layout

| File | Phase | Count |
|---|---|---|
| `phase-1.md` | Phase 1 (Stage 1-4 work) | 52 |
| `phase-2.md` | Phase 2 (Stage 5 + later) | 14 |
| `phase-3.md` | Phase 3 (post-MVP) | 2 |

Splitting follows the **Phase** column. Status (Done / In Progress / Not Started / Obsolete) is shown per task; obsolete tasks live in their original phase file (look for `**Status:** Obsolete`).

## Snapshot stats (as of refresh)

**Status:**
- ✅ Done: 11
- 🔄 In Progress: 5
- ⚪ Not Started: 42
- ⚫ Obsolete: 10 _(killed by v2 plan, pre-Vapi-pivot work)_

**Workstream:**
- LLM: 21
- Voice: 14
- Wiring: 13
- QA: 11
- Infrastructure: 9

## Column reference

| Column | Meaning |
|---|---|
| Status | Done / In Progress / Not Started / Obsolete (Blocked / Phase 3 also possible) |
| Task ID | `P1-XX`, `P2-XX`, `P3-XX` |
| Priority | Critical / High / Medium / Low |
| Weight | Effort weight (1-5) for sprint planning |
| Phase | Phase 1 / Phase 2 / Phase 3 |
| Tier | Backend / Frontend / Both |
| Workstream | Infrastructure / LLM / Voice / Wiring / QA |
| Title | Short summary |
| Assignee | Owner (Mint / Yonas / Said / etc) |
| Tested by Owner | e.g. `3/7` = 3 of 7 acceptance criteria tested. See `app-tasks-review` |
| Approved by Supervisor | Similar fraction |
| Description | One-paragraph what + why |
| Detailed Explanation | Multi-paragraph deep dive |
| Acceptance Criteria | SETUP / BUILD / VERIFY checklist |
| Criteria Progress | Current `tested/total` count |
| Visual / Figma | Link if applicable |
| Notes | Free-form, often `[RESET 2026-05-05]` markers for Vapi-pivot updates |
| Mint's / Yonas' / Said Comments | Per-owner annotations |
| Estimated Hours | Sprint planning hours |
| Issue IID / URL | GitLab issue link (synced via Apps Script) |
| Last synced | Last GitLab sync timestamp |

## How acceptance criteria flow

- Defined here in the **Acceptance Criteria** column (SETUP / BUILD / VERIFY sections).
- Tracked per criterion in `app-tasks-review` with **Tested by Owner** + **Approved by Supervisor** booleans.
- A task is **truly** done only when both columns are TRUE for every criterion. Status="Done" alone is not enough — check `app-tasks-review` too.

## V2 plan notes

- **P1-46** anonymization (Stage 1, ~3h) — `anon_id` everywhere downstream.
- **P1-47** crisis safety (Stage 4, ~1h) — single global system prompt rule.
- **P1-43** AI Context Cross-Channel HARD GATE — Phase 1 cannot ship without this passing.
- **P2-29..P2-37** are Stage 5 work (check-ins + text chat + feedback). NEW per v2 plan.
- Many P1-12..P1-16 tasks were RESET on 2026-05-05 for the Cartesia Line → Vapi pivot. Look for `[RESET 2026-05-05]` in Notes.

## GitLab sync (from Read Me)

- First 8 columns of the Tasks tab match Alejandro's GitLab sync script (`Title`, `Description`, `Labels`, `Assignee`, `Status`, `Issue IID`, `URL`, `Last synced`).
- Set `GITLAB_TOKEN` in Script Properties; recommended script change is `getSheets()[0]` → `getSheetByName('Tasks')` so the script always targets the Tasks tab.
- The webhook URL (GitLab → Sheet) needs Apps Script web app deployment + `WEBHOOK_SECRET`.
- Future enhancement: pass `assignee_id` to GitLab on issue creation (tracked as Asana **FF-34**).

## Refresh

```
mcp__google-sheets__get_sheet_data(
  spreadsheet_id="1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw",
  sheet="Tasks"
)
```

The response will overflow a single tool result (~95 KB). Runtime saves it to a temp file; re-run the Python extractor (`/Users/jonah/Documents/guided-growth-mvp/.claude/skills/app-tasks/` regenerates from the saved JSON via the same script used to seed it). Update `_Last refreshed_` at the bottom of each `phase-*.md`.

Trigger phrases: "refresh app-tasks", "resync tasks", "what's new in tasks?".

## Related

- `app-tasks-review` — per-criterion test/approval state.
- `app-screens` — each screen row's `Tasks Ref` column points back here.
- `app-architecture` + `app-llm-activation` — referenced from the task descriptions.

_Last refreshed: 2026-05-11_
