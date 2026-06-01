---
name: app-screens
description: Use when working on or referencing any app screen (SPLASH / WELCOME / AUTH-SIGNUP / VOICE-PREFERENCE / MIC-PERMISSION / ONBOARD-* / HOME-* / MCHECK-* / ECHECK-* / CHAT / HABIT-* / FOCUS-TIMER / INSIGHTS-ANALYTICS / SETTINGS / SUB-* / EVENING-REFLECTION-* etc), screen routes, AI Context Block content, Screen Type, Voice Engine / Voice Mode, voice content / MP3 assets, expected user response, edge cases, or any screen referencing UX rules / tooltips / PostHog events / session_log events / tasks
user-invocable: false
---

# Screens

Source: Google Sheet **Guided Growth OS App Master** · tab `Screens` · gid `1034476295` · maintained by Yair (with input from Mint, Timothy).

**MASTER per-screen reference.** Contains the AI Context Block, UI, voice text, system actions, edge cases, and references to every other tab. **This is the most-referenced tab in the workbook** — every implementation task targets one or more screens here.

Current sheet: **88 rows** across Phase 1 (22), Phase 2 (64), Phase 2+ (2).

## When to use
- Building, debugging, or reviewing any screen.
- Need the canonical AI Context Block to seed Supabase `screen_contexts`.
- Looking up a screen's voice engine, MP3 asset, expected user response, or edge cases.
- Cross-referencing UX Rules / Tooltips / PostHog events / session_log events / Tasks for a screen.

## File layout

| File | Group | Count |
|---|---|---|
| `phase-1.md` | MVP launch path — auth, onboarding (beginner), home, check-ins, chat, voice cap, habit / focus / insights / settings, etc | 22 |
| `phase-2-onboarding.md` | Advanced onboarding + extended beginner onboarding | _(see file)_ |
| `phase-2-subcategories.md` | SUB-* (Phase 2 subcategory response screens, 28 screens) | 28 |
| `phase-2-checkin-reflection.md` | Check-in / reflection extras (REFLECTION-LOG, EVENING-REFLECTION-*, etc) | 14 |
| `phase-2-habits.md` | Habit creation templates / edit / detail / list | 11 |
| `phase-2-home-and-chat.md` | Home extensions + CHAT + VOICE-CAP | 7 |
| `phase-2-focus-insights-settings.md` | FOCUS-TIMER, INSIGHTS-ANALYTICS, SETTINGS | 3 |
| `phase-2-misc.md` | _(catch-all for unclassified Phase 2 rows)_ | 1 |
| `phase-2-plus.md` | Phase 2+ screens | 2 |

Phase 1 vs Phase 2 split is per the **Phase** column. Phase 2 was further split because 64 screens in one file would be unwieldy.

## Column reference (32 columns)

| Column | Meaning |
|---|---|
| Screen ID | Stable identifier (e.g. `WELCOME`) — referenced elsewhere as the key |
| Screen Name | Human-readable name |
| Phase | Phase 1 / Phase 2 / Phase 2+ |
| Active? | `Yes` (built or building) / `Planned` (not yet) |
| Screen Type | `Silent` / `MP3-only` / `LLM-active` / `Hybrid` |
| Row Type | `Screen` / `Sub-screen` / etc |
| Route | URL path (e.g. `/welcome`) |
| Screen Text (Figma) | Exact UI copy as shown in Figma |
| **AI Context Block** | **The structured block the LLM reads on every call. Contains SCREEN, STATE, BEHAVIOR, DO NOT, NEXT.** Seeded to Supabase `screen_contexts` via `seed_contexts.py`. |
| Voice Engine | `None` / `MP3` / `Vapi` / `Cartesia Sonic API` |
| Voice Mode | `Generative` / `Verbatim` / `[silent]` |
| Voice Content | The actual text spoken (verbatim) or generation guidance |
| Voice Instructions | How the voice should behave on this screen |
| MP3 Asset | File name from `app-mp3-files` |
| Voice Notes | Free-form |
| Feedback Config | If applicable |
| Expected User Response | Tap targets + voice utterances expected |
| AI Response | Canonical response pattern |
| System Action | Numbered list of what the frontend does |
| Edge Cases | Failures, alternates, returning user, etc |
| Notes | Free-form |
| UX Rules Ref | Comma-separated `UX-XX` IDs |
| Tooltips Ref | Comma-separated `TT-XX` IDs |
| PostHog Events | Comma-separated event names |
| session_log Events | Comma-separated event types |
| Tasks Ref | Comma-separated `P1-XX` / `P2-XX` IDs |
| Figma Link | Direct Figma URL |
| Figma Frame | Frame name |
| figma_node_id | `xxxx:yyyy` (for deep linking + automation) |
| Stage | `Stage 1` … `Stage 5` (per v2 plan MVP execution stages) |
| Mint's / Yonas' Comments | Per-owner annotations |

## Phase 1 ordered tour (MVP launch path)

```
SPLASH → WELCOME → AUTH-SIGNUP / AUTH-LOGIN
       → VOICE-PREFERENCE → MIC-PERMISSION
       → POST-AUTH-01 [DEPRECATED]
       → ONBOARD-01 → ONBOARD-FORK
       → ONBOARD-BEGINNER-01..04, 06, 07 → STARTING-PLAN
       → HOME-FIRST (TT-01..TT-08 spotlight tour, UX-19)
       → HOME-MORNING / HOME-EVENING / HOME-RETURN
       → MCHECK-01, MCHECK-02
       → ECHECK-01..06
       → CHAT, VOICE-CAP
       → HABIT-CREATE-FORK / HABIT-EDIT / HABIT-DETAIL
       → FOCUS-TIMER, INSIGHTS-ANALYTICS, SETTINGS
```

## Key v2-plan changes (May 2026)

- **Onboarding is all Vapi.** No MP3s on SPLASH / WELCOME / VOICE-PREFERENCE / MIC-PERMISSION / POST-AUTH. Vapi live TTS in cloned voice via Cartesia Sonic 3.5; STT via Soniox (May 5 2026 pivot from Cartesia Line).
- **Check-ins use Async Reflection** (Path 2), not Vapi. See `app-architecture` → Async Reflection section.
- **POST-AUTH-01** is marked `[DEPRECATED]` — its responsibilities moved into the live Vapi flow.
- **Screen ID renames** logged in the Sync Log tab (see `app-overview`). Notable: ONBOARD-BEGINNER-10 → STARTING-PLAN (Phase 2 caught up to Figma name).

## How a screen references the other tabs

For each row:
- `UX Rules Ref` → look up in `app-ux-rules` (e.g. `UX-04, UX-09, UX-15`).
- `Tooltips Ref` → look up in `app-tooltips` (e.g. `TT-01`).
- `PostHog Events` → look up in `app-posthog-events`.
- `session_log Events` → look up in `app-session-events`.
- `Tasks Ref` → look up in `app-tasks` (e.g. `P1-17, P1-42`).

The `AI Context Block` is the most important column — it's what the LLM actually reads at runtime via Supabase `screen_contexts`.

## Refresh

```
mcp__google-sheets__get_sheet_data(
  spreadsheet_id="1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw",
  sheet="Screens"
)
```

The response will overflow a single tool result (~180 KB). Runtime saves it to a temp file; the same Python extractor that seeded this folder regenerates the per-section files. Update `_Last refreshed_` at the bottom of each file.

Trigger phrases: "refresh app-screens", "resync screens".

## Related

- `app-architecture` — pipeline that turns AI Context Block into Supabase `screen_contexts`.
- `app-llm-activation` — which LLM path each screen uses.
- `app-ux-rules`, `app-tooltips`, `app-posthog-events`, `app-session-events`, `app-tasks`, `app-mp3-files`, `app-coaching-styles`, `app-global-context` — every Screens row points at one or more of these.

_Last refreshed: 2026-05-11_
