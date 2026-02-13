# Feedback Loop Specification

## Overview

The feedback loop keeps users engaged and improving by turning daily inputs into timely signals, reinforcement, and course correction. It combines immediate feedback (completion, streaks, micro-celebrations), short-term reflection (daily/weekly review prompts), and long-term guidance (trend insights and habit adjustments) without overwhelming the user.

## User Flows

### Daily Completion Feedback

1. **User Saves Daily Entry**
   - Completion confirmation appears
   - Shows progress toward daily goals and streak status
   - Highlights any wins (e.g., "3-day streak")

2. **Micro-Celebration**
   - Subtle animation or badge for key milestones
   - Optional haptic/visual feedback on mobile
   - Dismisses automatically or on tap

### Missed Habit Recovery

1. **User Misses a Habit**
   - Next login shows a gentle prompt
   - Offers quick action: "Recommit" or "Adjust goal"

2. **Recommit Flow**
   - User selects a smaller target or new frequency
   - Streak resets or shifts to "recovery" mode
   - Encouraging message confirms the update

### Weekly Review

1. **Weekly Summary Trigger**
   - Appears on first login after week ends
   - Shows top habits, weak spots, and journal themes

2. **User Reflection**
   - Quick prompts: "What worked?" "What didn't?"
   - Optional next-week intention
   - Saves summary for later reference

### Insight Nudge

1. **Pattern Detected**
   - App identifies correlation or trend
   - Presents an insight card with action

2. **User Action**
   - User dismisses, saves, or applies the suggestion
   - Action updates future recommendations

## UI Requirements

- **Completion Feedback**
  - Lightweight confirmation banner after daily save
  - Streak indicator and habit completion count
  - Optional celebratory animation for milestones

- **Recovery Prompt**
  - Non-judgmental message after missed habits
  - Quick action buttons: Recommit, Adjust, Dismiss

- **Weekly Review Panel**
  - Summary card with key stats and streaks
  - Journal themes with highlighted phrases
  - One-click intention setting

- **Insight Cards**
  - Short, actionable insights
  - Clear CTA and dismiss option
  - Stored in an "Insights" history view

- **Notification Preferences**
  - Opt-in reminders and timing controls
  - Separate toggles for streaks, reviews, and insights

## Configuration

- shell: false

## Technical Notes

- Feedback events are derived from local data (entries, streaks, journal text).
- All prompts and insight history are user-specific and stored per user.
- Notifications must respect user opt-in settings and local device rules.
