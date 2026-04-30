# Feedback Loop

Turns daily inputs into timely signals, reinforcement, and course correction. Combines:

- **Immediate feedback** — completion confirmation, streaks, micro-celebrations
- **Short-term reflection** — daily and weekly review prompts
- **Long-term guidance** — trend insights and habit adjustments

…without overwhelming the user.

## User Flows

### Daily Completion Feedback

1. **User saves daily entry**
   - Completion confirmation appears
   - Shows progress toward daily goals and streak status
   - Highlights wins (e.g., "3-day streak")

2. **Micro-celebration**
   - Subtle animation or badge for key milestones
   - Optional haptic/visual feedback on mobile
   - Dismisses automatically or on tap

### Missed Habit Recovery

1. **User misses a habit**
   - Next login shows a gentle prompt
   - Quick action: "Recommit" or "Adjust goal"

2. **Recommit flow**
   - Select smaller target or new frequency
   - Streak resets or shifts to "recovery" mode
   - Encouraging message confirms the update

### Weekly Review

1. **Weekly summary trigger**
   - Appears on first login after the week ends
   - Shows top habits, weak spots, and journal themes

2. **User reflection**
   - Quick prompts: "What worked?" / "What didn't?"
   - Optional next-week intention
   - Saves summary for later reference

### Insight Nudge

1. **Pattern detected**
   - App identifies correlation or trend
   - Insight card with action

2. **User action**
   - Dismiss, save, or apply the suggestion
   - Action updates future recommendations

## UI Requirements

- **Completion feedback** — lightweight banner after daily save; streak indicator and habit completion count; optional celebratory animation for milestones
- **Recovery prompt** — non-judgmental message after missed habits; quick actions: Recommit, Adjust, Dismiss
- **Weekly review panel** — summary card with key stats and streaks; journal themes with highlighted phrases; one-click intention setting
- **Insight cards** — short, actionable; clear CTA and dismiss; stored in an "Insights" history view
- **Notification preferences** — opt-in reminders and timing controls; separate toggles for streaks, reviews, and insights

## Notes

- Feedback events are derived from local data (entries, streaks, journal text)
- All prompts and insight history are user-specific
- Notifications must respect user opt-in settings and local device rules
