---
name: app-mp3-files
description: Use when working with MP3 audio assets, Yair's cloned voice files, voice_cap.mp3, category/subcategory/milestone/checkin MP3 inventories, Supabase Storage voice-assets paths, or P2-30 / P2-36 tone bible scope
user-invocable: false
---

# MP3 Files

Source: Google Sheet **Guided Growth OS App Master** · tab `MP3 Files` · gid `76673373` · maintained by Yair.

Catalog of pre-recorded audio assets used by check-ins, milestones, voice cap, and Phase 2 onboarding response screens. All in **Yair's cloned voice**, VA-generated via Cartesia playground (per `P2-30`), file names + scripts come from the tone bible (`P2-36`).

## When to use
- Wiring `useVoicePlayer` — need to know which file plays on which screen.
- Confirming whether an MP3 exists in MVP scope or is deferred to Phase 2 (subcategory / category / milestone are deferred).
- Looking up Supabase Storage URL conventions.
- Verifying duration / voice ID before adding a new MP3.

## Inventory

| File Name | Screen | Duration | Audio Type | Voice ID | Status | Notes |
|---|---|---|---|---|---|---|
| `voice_cap.mp3` | `VOICE-CAP` | ~6s | Phase 2. Pre-recorded. | Yair's clone | Not Started | "You've used your voice sessions for today." |
| `category_*.mp3` (8 files) | `ONBOARD-BEGINNER-01` | ~8s each | Phase 2. Pre-recorded category responses. | Yair's clone | Not Started | 8 files: `cat_sleep`, `cat_move`, `cat_eat`, `cat_energy`, `cat_stress`, `cat_focus`, `cat_break`, `cat_organized`. |
| `subcat_*.mp3` (29 files) | `ONBOARD-BEGINNER-02` | ~10s each | Phase 2. Pre-recorded subcategory responses. | Yair's clone | Not Started | One per subcategory. |
| `milestone_*.mp3` (8 files) | `HABIT-DETAIL` | 5-15s each | Phase 2. Streak milestone moments. | Yair's clone | Not Started | Milestones: 3, 7, 14, 30, 60, 90, 100, 365 days. Escalating emotional weight. |
| `checkin_*.mp3` (~30 files — MVP scope, reduced from 65) | `MCHECK-01`, `MCHECK-02`, `ECHECK-01..06` | ~3-8s each | Async reflection MP3s. Prompts, thinking acks, mood-matched closings. | Yair's clone | Not Started | Stage 5 work. Exact filenames + scripts from `P2-36` (Yair tone bible). VA-generated via Cartesia playground per `P2-30`. |

## Supabase Storage URL convention

```
https://[project].supabase.co/storage/v1/object/public/voice-assets/[filename].mp3
```

Replace `[project]` with the actual Supabase project ID once it's wired (Yair to paste the URL).

## Scope decisions (from Read Me + Architecture)

- **Onboarding MP3s removed** — replaced by Vapi live TTS in v2 plan. No MP3s on SPLASH / WELCOME / VOICE-PREFERENCE / MIC-PERMISSION / POST-AUTH.
- **MVP MP3 scope reduced**: P2-30 generates ~30 (down from 65). Subcategory (29), category (8), milestone (8) deferred to Phase 2 (Asana **FF-18**).
- **MVP MP3s** = morning prompts (~6-8), morning closings (~3 mood-matched), evening prompts (~6-8), evening closings (~3-4 mood-matched), Async Reflection acknowledgment cues (~5-8).

## Related

- `app-architecture` — Async Reflection state machine (PROMPT → LISTENING → THINKING → RESPONDING → FOLLOWUP_OPTIONAL → CLOSING → DONE).
- `app-ux-rules` — `UX-21` async reflection pattern.
- `app-tasks` — `P2-30` MP3 generation; `P2-36` tone bible.

## Refresh

```
mcp__google-sheets__get_sheet_data(
  spreadsheet_id="1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw",
  sheet="MP3 Files"
)
```

Trigger: "refresh app-mp3-files" or "resync the sheet".

_Last refreshed: 2026-05-11_
