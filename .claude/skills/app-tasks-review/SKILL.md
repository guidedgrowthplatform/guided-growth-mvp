---
name: app-tasks-review
description: Use when checking per-criterion test/approval status for an engineering task (P1-XX or P2-XX), tracking which acceptance criteria are tested-by-owner and approved-by-supervisor, or auditing what verification remains before a task can be closed
user-invocable: false
---

# Tasks Review

Source: Google Sheet **Guided Growth OS App Master** · tab `Tasks Review` · gid `1886087000`.

Per-criterion test + approval ledger for every engineering task. Each task in `app-tasks` has multiple acceptance criteria; this tab tracks each one with two booleans: **Tested by Owner** and **Approved by Supervisor**.

## When to use
- A task is marked "Done" in `app-tasks` — confirm each criterion is also TRUE here before closing.
- Auditing what verification work is outstanding for a Phase 1 task.
- The user asks "is P1-XX really done?" — check both **Tested by Owner** AND **Approved by Supervisor**.

## Column reference

| Column | Meaning |
|---|---|
| Task ID | `P1-XX`, `P2-XX`, `P3-XX` — links back to `app-tasks` |
| Section | Group within the task: SETUP / BUILD / VERIFY / PLAN / etc |
| # | Criterion index inside the section (1, 2, 3, ...) |
| Criterion | Plain-English statement of what must hold |
| Tested by Owner | `TRUE` / `FALSE` — the task owner has verified themselves |
| Approved by Supervisor | `TRUE` / `FALSE` — supervisor has signed off |
| Notes | Free-form context |

## Current snapshot (non-empty rows)

> Truncated to populated rows. Empty placeholder rows in the sheet are ignored. **Refresh** for current state.

| Task | Section | # | Criterion | Owner✓ | Supervisor✓ | Notes |
|---|---|---|---|---|---|---|
| P1-01 | SETUP | 1 | `.github/workflows/ci.yml` exists with one job per GitLab job | TRUE | FALSE | This is working properly on GitHub. |
| P1-01 | SETUP | 2 | All required secrets present in GitHub repo settings | FALSE | | |
| P1-01 | BUILD | 1 | Workflow triggers on push + PR to main | FALSE | | |
| P1-01 | BUILD | 2 | Cache hit reduces re-run time by >40% | FALSE | | |
| P1-01 | VERIFY | 1 | Test push: every job conclusion=success on GitHub | FALSE | | |
| P1-01 | VERIFY | 2 | Deploy step produces an artifact identical to GitLab's | FALSE | | |
| P1-01 | VERIFY | 3 | One week of parallel runs shows zero GitHub-only failures | FALSE | | |
| P1-02 | SETUP | 1 | `VAPI_PUBLIC_KEY` present in `.env.local` AND in CI secrets | FALSE | FALSE | |
| P1-02 | SETUP | 2 | Cartesia + OpenAI keys confirmed present in Vapi dashboard (sanity) | FALSE | | |
| P1-02 | SETUP | 3 | `@vapi-ai/web` appears in frontend package.json with pinned version | FALSE | | |
| P1-02 | BUILD | 1 | `npm install` completes; lockfile updated | FALSE | | |
| P1-02 | BUILD | 2 | Import in a smoke-test component compiles without TS errors | FALSE | | |
| P1-02 | VERIFY | 1 | Vapi dashboard hello-world session uses Yair's cloned voice | FALSE | | |
| P1-02 | VERIFY | 2 | Round-trip (mic → STT → LLM → TTS → speaker) works end-to-end | FALSE | | |
| P1-03 | SETUP | 1 | Service-account JSON received and stored in backend secret store | FALSE | FALSE | |
| P1-03 | SETUP | 2 | Both target tables exist in Supabase: `screen_contexts`, `session_log` (or `events_taxonomy` if Mint decides) | FALSE | | |
| P1-03 | BUILD | 1 | `scripts/seed_contexts.py` exists, runs end-to-end against the live sheet | FALSE | | |
| P1-03 | BUILD | 2 | `scripts/seed_session_log_events.py` exists, runs end-to-end | FALSE | | |
| P1-03 | BUILD | 3 | Both scripts are idempotent: re-running with no sheet changes makes zero DB writes | FALSE | | |
| P1-03 | BUILD | 4 | Both scripts have retry-with-backoff on Sheets 5xx | FALSE | | |
| P1-03 | BUILD | 5 | Cloudflare Worker cron deployed firing every 1 min, triggering the backend workflow | FALSE | | |
| P1-03 | VERIFY | 1 | Edit a row in Screens tab → within 1 min, SELECT `screen_contexts` shows the new value | FALSE | | |
| P1-03 | VERIFY | 2 | Edit a row in `session_log Events` tab → within 1 min, target table reflects it | FALSE | | |
| P1-03 | VERIFY | 3 | Run sync against unchanged sheet → log shows "no changes", DB unchanged | FALSE | | |
| P1-03 | VERIFY | 4 | Sync run `conclusion=success` on the actual cron schedule for 24 hours straight (no failure emails) | FALSE | | |
| P1-03 | VERIFY | 5 | Service account stays read-only (Viewer on the Sheet — no write needed for this direction) | FALSE | | |
| P1-03 | VERIFY | 6 | Global Context tab is NOT touched by either script (verified by code review) | FALSE | | |
| P1-04 | SETUP | 1 | Migration file checked in and applied | FALSE | FALSE | |
| P1-04 | BUILD | 1 | Table exists with all 7 columns + index on `(anon_id, timestamp DESC)` | FALSE | | |
| P1-04 | BUILD | 2 | RLS policy denies SELECT/INSERT for anon_ids other than the caller's | FALSE | | |
| P1-04 | BUILD | 3 | POST `/api/session_log` validates anon_id and returns 200 + row id | FALSE | | |
| P1-04 | VERIFY | 1 | 1000-row insert completes in <2s | FALSE | | |
| P1-04 | VERIFY | 2 | Query "last 50 events for anon_id X" returns in <50ms | FALSE | | |
| P1-04 | VERIFY | 3 | Cross-user read attempt (forged anon_id) returns 403 | FALSE | | |
| P1-05 | SETUP | 1 | `/api/context` route exists in backend router | FALSE | FALSE | |
| P1-05 | BUILD | 1 | Returns 200 with the documented JSON shape for valid requests | FALSE | | |
| P1-05 | BUILD | 2 | Returns 404 for unknown screen_id, 401 for missing anon_id | FALSE | | |
| P1-05 | BUILD | 3 | Cache implemented (verified by repeated identical requests showing same version) | FALSE | | |
| P1-05 | VERIFY | 1 | p50 latency <80ms, p99 <250ms over 1k synthetic requests | FALSE | | |
| P1-05 | VERIFY | 2 | Stale cache invalidates within 60s of a sheet → DB sync | FALSE | | |
| P1-06 | SETUP | 1 | `/docs/anon-id-contract.md` exists and is linked from `/docs/README.md` | FALSE | FALSE | |
| P1-06 | BUILD | 1 | Vapi assistant config tool calls pass `anon_id`, not `user_id` | FALSE | | |
| P1-06 | BUILD | 2 | PostHog `identify()` uses `anon_id` | FALSE | | |
| P1-06 | VERIFY | 1 | Code review checklist updated to flag `user_id` usage in behavioral context | FALSE | | |
| P1-06 | VERIFY | 2 | PostHog dashboard sample event: `distinct_id` = `anon_id` | FALSE | | |
| P1-07 | SETUP | 1 | `src/llm/tools.ts` (or equivalent) exists in shared module path | FALSE | FALSE | |
| P1-07 | BUILD | 1 | All 4 tools defined with strict JSON schema matching docs | FALSE | | |
| P1-07 | BUILD | 2 | Each tool delegates to existing backend API endpoints, no logic duplicated | FALSE | | |
| P1-07 | VERIFY | 1 | Vapi config and Direct LLM both import from this module — single source | FALSE | | |
| P1-07 | VERIFY | 2 | Same input on both paths produces identical `tool_call` payload (diff = empty) | FALSE | | |
| P1-08 | SETUP | 1 | Inventory committed as `/docs/legacy-tools-audit.md` | FALSE | FALSE | |
| P1-08 | BUILD | 1 | All legacy tool defs deleted from `/agent/tools.py` (or equivalent) | FALSE | | |
| P1-08 | BUILD | 2 | Legacy code imports the shared module instead | FALSE | | |
| P1-08 | VERIFY | 1 | `grep -r "def.*_tool\|export.*Tool"` returns hits only in `src/llm/tools.ts` | FALSE | | |
| P1-08 | VERIFY | 2 | Existing legacy tests still pass | FALSE | | |
| P1-09 | SETUP | 1 | Canonical 4-block shape documented in `/docs/llm-context.md` | FALSE | FALSE | |
| P1-09 | BUILD | 1 | Vapi system prompt template references all 4 blocks by placeholder | FALSE | | |
| P1-09 | BUILD | 2 | context builder (P1-42) returns the same shape Path 3 consumes | FALSE | | |
| P1-09 | VERIFY | 1 | Same screen + same user state → Vapi and Direct LLM see identical context blocks (diff is empty) | FALSE | | |
| P1-10 | SETUP | 1 | `CHECKIN_SCREENS` list defined in shared module | FALSE | FALSE | |
| P1-10 | BUILD | 1 | `callLLM()` exists in shared backend module | FALSE | | |
| P1-10 | BUILD | 2 | Routing matches the 3-rule spec exactly (verified by unit test per branch) | FALSE | | |
| P1-10 | BUILD | 3 | Provider is swappable via env var (proven by test with mock LLM) | FALSE | | |
| P1-10 | VERIFY | 1 | Smoke test: 1 invocation per path returns the expected response shape | FALSE | | |
| P1-10 | VERIFY | 2 | Routing decision visible in `session_log` within 1s of the call | FALSE | | |
| P1-11 | SETUP | 1 | Context builder function exists in shared backend module | FALSE | FALSE | |
| P1-11 | BUILD | 1 | Vapi assistant config has `before_llm_call` webhook pointing at our endpoint | FALSE | | |
| P1-11 | BUILD | 2 | Webhook returns within 200ms p99 (so it doesn't block voice latency) | FALSE | | |
| P1-11 | BUILD | 3 | Same backend function feeds Path 1 (Vapi) and Path 3 (`/api/llm`) | FALSE | | |
| P1-11 | VERIFY | 1 | Diff test: Vapi context payload vs Direct LLM context payload for same (screen, user) → empty | FALSE | | |
| P1-11 | VERIFY | 2 | Onboarding test session uses fresh per-call context (verified in Vapi logs) | FALSE | | |
| P1-12 | SETUP | 1 | `src/contexts/VoiceContext.tsx` exports `VoiceProvider` + `useVoiceContext` | FALSE | FALSE | |
| P1-12 | SETUP | 2 | Compiles under tsconfig strict mode with no `any` | FALSE | | |
| P1-12 | BUILD | 1 | Reducer covers all 4 action types and rejects invalid transitions | FALSE | | |
| P1-12 | BUILD | 2 | `<VoiceProvider>` wraps `app/layout.tsx` at root | FALSE | | |
| P1-12 | BUILD | 3 | Default state on first mount matches what VOICE-PREFERENCE reads | FALSE | | |
| P1-12 | VERIFY | 1 | `console.log(useVoiceContext())` on WELCOME prints all 4 fields | FALSE | | |
| P1-12 | VERIFY | 2 | Dev mic-toggle → MIC-PERMISSION re-renders with new permission in <100ms | FALSE | | |
| P1-12 | VERIFY | 3 | Removing provider in dev breaks WELCOME (proves wrap is real) | FALSE | | |
| P1-13 | SETUP | 1 | Type `VoiceContextValue` includes `vapiSessionActive: boolean` | FALSE | FALSE | |
| P1-13 | BUILD | 1 | Flag flips to true when `useRealtimeVoice` opens a Vapi session | FALSE | | |
| P1-13 | BUILD | 2 | Flag flips to false on session end OR component unmount (whichever first) | FALSE | | |
| P1-13 | BUILD | 3 | Cleanup effect cancels any in-flight Vapi connection on unmount | FALSE | | |
| P1-13 | VERIFY | 1 | `callLLM()` routes to Vapi when flag is true (verified via integration test) | FALSE | | |
| P1-13 | VERIFY | 2 | Forced navigation mid-session: Vapi billing shows no minutes leaked beyond unmount | FALSE | | |
| P1-14..P1-34 | _(per-section criteria, all FALSE)_ | | _Hook signatures, contexts, screen shells, audits, eval matrices, cost/latency budgets, multi-platform smoke, etc. See full table for each criterion._ | FALSE | | |
| P2-01..P2-13 | _(per-section criteria, all FALSE)_ | | _Phase 2: async reflection, feedback sessions, ~30 MP3s, HOME screens, MCHECK/ECHECK screens, tone bible, text chat, Insights, GitLab sync._ | FALSE | | |
| **P3-01** | SETUP | 1 | Pipecat vs alternatives decision documented | **TRUE** | **TRUE** | |
| **P3-01** | BUILD | 1 | Pipecat deployed with Cartesia STT/TTS plugins | **TRUE** | | |
| **P3-01** | BUILD | 2 | Voice quality matches Vapi (Yair-reviewed by ear) | **TRUE** | | |
| P3-01 | BUILD | 3 | `useRealtimeVoice` can swap endpoint via env var | FALSE | | |
| P3-01 | VERIFY | 1 | One week parallel run: latency p95 within 10% of Vapi | FALSE | | |
| P3-01 | VERIFY | 2 | Per-session cost <30% of Vapi cost | FALSE | | |
| P3-01 | VERIFY | 3 | Decision to cut over (or roll back) documented at end of parallel run | FALSE | | |

**Notable**: only `P1-01 SETUP#1` and `P3-01 SETUP#1 / BUILD#1 / BUILD#2` are TRUE on **Tested by Owner**. Almost nothing has supervisor approval yet (`P3-01 SETUP#1` is the only TRUE). Vast majority is FALSE — represents the actual verification backlog.

## How to use this with `app-tasks`

`app-tasks` shows the task itself + acceptance criteria as a checklist. Tasks Review is the **state of that checklist**: which boxes are actually ticked by the owner and supervisor. A task can be marked "Done" in the Tasks tab but still have FALSE criterion rows here — that's the verification debt.

## Related

- `app-tasks` — task definitions, descriptions, acceptance criteria text.
- `app-overview` — refresh playbook.

## Refresh

```
mcp__google-sheets__get_sheet_data(
  spreadsheet_id="1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw",
  sheet="Tasks Review"
)
```

Trigger: "refresh app-tasks-review" or "resync the sheet".

_Last refreshed: 2026-05-11_
