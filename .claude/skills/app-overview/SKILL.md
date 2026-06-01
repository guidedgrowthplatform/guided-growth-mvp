---
name: app-overview
description: Use when referencing "the master sheet", refreshing data from Google Sheets, mapping a topic to its tab, looking up the spreadsheet ID or tab gids, or understanding how the app-* skills relate to each other
user-invocable: false
---

# App Master Sheet — Overview

Source: Google Sheet **Guided Growth OS App Master** · spreadsheet ID `1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw` · [open in browser](https://docs.google.com/spreadsheets/d/1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw)

Single source of truth for the entire Guided Growth OS app — screens, UX rules, tasks, events, architecture. Each tab is mirrored into its own `app-*` skill so the content is searchable and auto-invocable.

## When to use
- Need to know which tab/skill holds a particular kind of info.
- User says "refresh the sheet", "resync the sheets", or "pull fresh data".
- Need the spreadsheet ID, link, or a tab's `gid` for deep-linking.
- Want high-level workbook context (v2 plan decisions, May 2026 Vapi pivot, color legend).

## Tab → skill map

| Tab | Skill | gid | Shape |
|---|---|---|---|
| Read Me | `app-overview` (this) | `1258919294` | single |
| Tasks | `app-tasks` | `1687604173` | folder (phase split) |
| Tasks Review | `app-tasks-review` | `1886087000` | single |
| Screens | `app-screens` | `1034476295` | folder (phase + section split) |
| session_log Events | `app-session-events` | `1240955040` | single |
| LLM Activation | `app-llm-activation` | `1245145682` | single |
| Global Context | `app-global-context` | (no live tab; baked into system prompt) | single |
| UX Rules | `app-ux-rules` | `1169394369` | single |
| Tooltips | `app-tooltips` | `1296180754` | single |
| PostHog Events | `app-posthog-events` | `211484324` | single |
| Architecture | `app-architecture` | `1097854436` | single |
| MP3 Files | `app-mp3-files` | `76673373` | single |
| Coaching Styles | `app-coaching-styles` | `1886967524` | single |
| Glossary | `app-glossary` | `1901215804` | single |
| Sync Log | _(not mirrored)_ | `1440880178` | — |

Deep-link to a specific tab: `https://docs.google.com/spreadsheets/d/<spreadsheet_id>/edit#gid=<gid>`.

## Cross-tab references (from Read Me)

- Each **Screen** row references UX Rules by ID, Tooltips by ID, PostHog events fired, session_log events written, and Tasks (P1-XX, P2-XX) that build it.
- **Tasks** reference Screens in Description / Detailed Explanation.
- **Architecture** tab is the canonical prose reference — if anything else contradicts, Architecture wins.
- Asana **FF-XX** (Future Features) and **BR-XX** (Brainstorm) IDs are referenced from Global Context entries — those tabs are no longer in the sheet, they live in Asana now.

## V2 plan — key decisions (locked May 2026)

- **All 5 stages = MVP.** Stage 1 Foundation → Stage 2 `callLLM` wrapper + integrations → Stage 3 Onboarding LLM-active screens → Stage 4 QA/safety/polish → Stage 5 Check-ins/text-chat/feedback.
- **Onboarding = all Vapi** (Soniox STT + Cartesia Sonic 3.5 TTS through Vapi). No MP3s on SPLASH/WELCOME/PREF/MIC/POST-AUTH. Switched from Cartesia Line May 5 2026 (Line concurrency limits at scale).
- **Check-ins = Async Reflection** (NOT Vapi). MP3 prompt → user voice → MP3 thinking ack → LLM response via Cartesia Sonic API. Target ~$0.006/check-in.
- **Anonymization in MVP** (P1-46, Stage 1, ~3 hours). `anon_id` flows through `callLLM()`, session_log, PostHog. Identity (email, name) lives separately.
- **Crisis safety** (P1-47, Stage 4, ~1 hour) — single global system prompt rule. UX-06 + GC-15.
- **Text chat** = GPT-4o mini direct (no Cartesia). **Feedback sessions** = scheduled Vapi triggers (1 week, 1 month, manual).
- **MP3 scope reduced for MVP**: P2-30 generates ~30 MP3s instead of 65; subcategory/category/milestone deferred to Phase 2 (Asana FF-18).
- **Salvage from pre-pivot work**: ~85% survives; the 15% changing is backend Vapi config replacing Cartesia Line agent code (~1-2 days Yonas) and `useRealtimeVoice` (~1 day Mint).

## Workbook counts (from Read Me, as of refresh)

- **67 screens** (Yair's count; current sheet shows 88 rows including Phase 2+)
- **59 engineering tasks** (current sheet: 68 task rows across Phase 1/2/3)
- **23 UX rules** (UX-01 to UX-23)
- **12 tooltips** (TT-01 to TT-12 — 8 spotlight tour + 4 auto-dismiss)
- **15-16 Global Context entries** (GC-01 to GC-16, GC-16 placeholder)
- **25 session_log event types**
- **~70 PostHog events** (3 NEW in v6.0)
- **5 MP3 file groups**
- **39 coaching style scenarios** (15 Warm & Thoughtful active + 11 Honest & Direct + 13 Calm & Reflective post-MVP)
- **41 glossary terms**

## Color legend (Tasks + Screens)

| Color | Meaning |
|---|---|
| Green | Done |
| Yellow | In Progress, OR new in v6.0 / v2 plan |
| Orange | Follow-up on already-Done work, pending verification |
| Red | Blocked |
| Gray | Phase 2 screens (planned, not yet built) / Obsolete tasks |
| Purple | Phase 3 (post-MVP) |
| White / no fill | Not Started |

## Maintainers (from Read Me)

- **Yair** — primary maintainer · Screens · Architecture · LLM Activation · MP3 Files · Coaching Styles · Read Me
- **Mint** — Tasks (frontend)
- **Yonas** — Tasks (backend) · session_log Events · PostHog Events (taking over from Said)
- **Timothy** — UX Rules · Tooltips

## Refresh playbook

**Single tab** — repull and overwrite the matching skill file:
```
mcp__google-sheets__get_sheet_data(
  spreadsheet_id="1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw",
  sheet="<exact tab name>"
)
```

**Trigger phrases the user may use**:
- "refresh app-<slug>" — repull that one tab and rewrite the file.
- "refresh the sheet" / "resync" — repull every tab and rewrite all 14 skills.
- "what's new in tasks?" — diff: repull `Tasks`, compare to the existing `app-tasks/*.md`, report deltas.

**Big tabs** (Tasks ~95 KB, Screens ~180 KB) overflow a single MCP response — fetched into a temp file the runtime writes for us, then sliced with `jq` per phase before writing the sub-files.

## Not in scope

- **Sync Log** tab (internal change history; not useful as a skill).
- Server-side seeding into Supabase — that's task **P1-03** (Mint), separate workstream. The skills here are a Claude-Code-side reference, not the runtime seed pipeline.

_Last refreshed: 2026-05-11_
