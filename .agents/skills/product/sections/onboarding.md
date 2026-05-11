# Onboarding

First-run personalization flow. Sets up each user's habit and journaling system without manual configuration. User exits onboarding ready to log Day 1 — no empty states.

> Shared UX (multi-modal input, responsive, accessibility) lives in [../conventions.md](../conventions.md).

## Onboarding Flow

### 1. Welcome & Context

Welcome message explains the app's value and sets the expectation that setup will personalize their system. No input — just context.

### 2. Habit Experience Level

- Question: "Have you tracked habits before?"
- Options: "No, I'm new to habit tracking" / "Yes, I already track habits"
- Answer determines guidance depth in the next step

### 3a. Beginner Habit Flow (if new)

- System recommends starting with **one habit to build + one habit to reduce**
- Select from examples or add custom
- Build examples: Exercise, Reading, Meditation, Drinking water, Journaling, Consistent sleep
- Reduce examples: Excessive social media, Junk food, Staying up late, Procrastination
- Each habit configured with: name, type (build/reduce), frequency (daily)

### 3b. Experienced Habit Flow (if already tracks)

- Choose: "Enter manually" or "Import existing habits"
- Manual: add habits one by one with full configuration
- Import: copy-pasted text, screenshot upload (AI extracts), or Google Sheets
- AI parses imported habits and asks clarifying questions only if needed

### 4. Journaling Setup

- Default active sections: "Proud of", "Grateful for", "Forgive myself for"
- User can rename, disable, or add custom sections
- Custom examples: "What I learned today", "What drained my energy", "What I did despite resistance"
- Output: list of active journal section labels

### 5. Affirmation Setup

- Choose: one fixed affirmation, multiple rotating affirmations, or skip
- Input via text or basic STT
- Output: affirmations list + rotation mode

### 6. Input Method Selection

- Choose: Spreadsheet (fast, grid-based) or Form (structured, focused) for daily entry
- Preference saved and used on the capture page

### 7. AI Insights Preferences

User selects which insights to enable:

- Habit consistency trends
- Missed habit patterns
- Correlation between habits and journal entries
- Weekly summaries
- Gentle accountability reminders
- Recurring journal theme detection
- Identity-based insights

Stored for future AI features.

### 8. Feedback & Feature Requests

Message: users can submit feature ideas any time while using the app. Feedback mechanism enabled.

### 9. Onboarding Complete

- Lands directly on Day 1 capture page
- No empty states — habits and journaling structure ready
- Can immediately start logging

## UI Requirements (Specific to Onboarding)

- Step-by-step wizard
- Progress indicator showing current step
- Can navigate back to previous steps
- Multi-modal input at every stage (see conventions)
- Clean, focused design — doesn't overwhelm beginners
- Smart defaults with customization options
