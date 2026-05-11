---
name: app-tooltips
description: Use when working with tooltip IDs (TT-01 through TT-12), copy for the HOME-FIRST spotlight tour, mic / AI toggle / chat / add-habit / feedback / streak / note / complete tooltips, the habit-detail heatmap legend, or the insights screen tooltips
user-invocable: false
---

# Tooltips

Source: Google Sheet **Guided Growth OS App Master** · tab `Tooltips` · gid `1296180754` · maintained by Timothy.

12 canonical tooltips: 8 spotlight-tour tips on `HOME-FIRST` (TT-01 to TT-08), plus 4 auto-dismiss tooltips for habit detail + insights screens.

## When to use
- A screen spec references `TT-XX` in its `Tooltips Ref` column.
- Implementing the first-time spotlight tour on `HOME-FIRST` (see also `UX-19`).
- Writing tooltip copy — use the existing strings verbatim unless changing them in the sheet first.

## Spotlight tour (TT-01 → TT-08, sequential on HOME-FIRST)

Sequential — user taps **Next** to advance, skippable. Shown once per account. Per `UX-19`.

| ID | Where | Text |
|---|---|---|
| TT-01 | Home > Orb — Mic side (left) | I'm always listening when blue. I'll go quiet after 8 seconds of silence — tap to wake me back up. |
| TT-02 | Home > Orb — AI side (right) | Tap to switch between voice and text mode. Whatever you pick stays as your default. |
| TT-03 | Home > Open Chat (bottom bar) | Your conversation transcript — everything we've talked about, all in one place. |
| TT-04 | Home > Add Habit (+ button, top right) | Tap here to add a new habit to your daily list. |
| TT-05 | Home > Feedback button | Tell us what's working and what's not. Your feedback helps us improve and shapes what we build next. |
| TT-06 | Home — Habit Card > Streak icon (flame + number) | Days in a row you've completed this habit. |
| TT-07 | Home — Habit Card > Note icon | Add a quick note about how it went. |
| TT-08 | Home — Habit Card > Complete icon (+ or checkmark) | Tap to log this habit as done for today. |

## Auto-dismiss tooltips (TT-09 → TT-12)

Auto-dismiss after 4 seconds OR on any user interaction. Shown once per screen per account.

| ID | Where | Text | When |
|---|---|---|---|
| TT-09 | Habit Detail > Calendar heatmap | Blue = completed, Red = missed, Grey = scheduled day off. | First time user opens any Habit Detail screen |
| TT-10 | Insights > Overall Analytics / Check-in History toggle | Switch between habit trends and your daily check-in history. | First time user opens Insights |
| TT-11 | Insights — Analytics > Mood Correlation section | AI-detected patterns between your sleep, energy, and stress vs. your mood. | First time user opens Insights |
| TT-12 | Insights — History > Three dots menu (...) | Edit or delete this check-in. | First time user opens Insights — History |

All entries are **Active** and have no separate voice variant.

## Refresh

```
mcp__google-sheets__get_sheet_data(
  spreadsheet_id="1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw",
  sheet="Tooltips"
)
```

Trigger: "refresh app-tooltips" or "resync the sheet".

_Last refreshed: 2026-05-11_
