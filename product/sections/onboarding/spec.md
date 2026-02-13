# Onboarding Specification

## Overview

A comprehensive onboarding flow that personalizes each user's habit tracking and journaling system without requiring manual configuration. Users finish onboarding with their habits defined, journaling format configured, and can immediately start logging data. The system supports multi-modal input (text, basic speech-to-text, copy-paste) throughout, and provides immediate value from day one with no empty states or additional setup required.

**Note:** Basic speech-to-text (converting voice to text) is included in this section. Full AI Voice features (conversational AI, voice coaching, intelligent voice interactions) are handled in the AI Voice section (Section 3).

## User Flows

### Onboarding Flow

1. **Welcome & Context**
   - User sees welcome message explaining the app's value
   - Sets expectations that setup will personalize their system
   - No input required, just context setting

2. **Habit Experience Level**
   - User answers: "Have you tracked habits before?"
   - Options: "No, I'm new to habit tracking" or "Yes, I already track habits"
   - Determines guidance depth for next steps

3. **Beginner Habit Flow** (if new to habit tracking)
   - System recommends starting with: one habit to build, one habit to reduce
   - User can select from examples or add custom habits
   - Examples to build: Exercise, Reading, Meditation, Drinking water, Journaling, Consistent sleep
   - Examples to reduce: Excessive social media, Junk food, Staying up late, Procrastination
   - Each habit configured with: name, type (build/reduce), frequency (daily)

4. **Experienced Habit Flow** (if already tracks habits)
   - User chooses: "Enter manually" or "Import existing habits"
   - Manual entry: Add habits one by one with full configuration
   - Import: Supports copy-pasted text, screenshot upload (AI extracts), or Google Sheets import
   - AI parses imported habits and asks clarifying questions only if needed

5. **Journaling Setup**
   - Default active sections: "Proud of", "Grateful for", "Forgive myself for"
   - User can rename any section, disable sections, or add custom sections
   - Example custom sections: "What I learned today", "What drained my energy", "What I did despite resistance"
   - Final output: List of active journal section labels

6. **Affirmation Setup**
   - User chooses: One fixed affirmation, multiple rotating affirmations, or skip
   - Can input via text or basic speech-to-text
   - Output: List of affirmations with rotation mode

7. **Input Method Selection**
   - User chooses: "Spreadsheet" or "Form" view for daily entry
   - Spreadsheet: Fast, flexible, grid-based entry
   - Form: Structured, guided, focused entry
   - Preference saved and used for daily capture

8. **AI Insights Preferences**
   - User selects which insights they want:
     - Habit consistency trends
     - Missed habit patterns
     - Correlation between habits and journal entries
     - Weekly summaries
     - Gentle accountability reminders
     - Recurring journal theme detection
     - Identity-based insights
   - Preferences stored for future AI features

9. **Feedback & Feature Requests**
   - Message: Users can submit feature ideas anytime while using the app
   - Feedback mechanism enabled

10. **Onboarding Complete**
    - User lands directly on Day 1 capture page
    - No empty states
    - All habits and journaling structure ready
    - Can immediately start logging data

## UI Requirements

- **Onboarding Flow**
  - Step-by-step wizard interface
  - Progress indicator showing current step
  - Can navigate back to previous steps
  - Multi-modal input support at every stage (text, basic speech-to-text, copy-paste)
  - Clean, focused design that doesn't overwhelm beginners
  - Smart defaults with customization options

- **Multi-Modal Input**
  - Voice input button/icon available at all text inputs
  - Basic speech-to-text conversion (voice-to-text, not AI Voice features)
  - Visual feedback during voice input (recording indicator)
  - Copy-paste works seamlessly in all text fields
  - Note: Full AI Voice features (conversational AI, voice coaching) are in AI Voice section

- **Responsive Design**
  - Mobile-friendly layouts
  - Touch-optimized interactions
  - Keyboard shortcuts work on desktop
  - Voice input accessible on mobile

- **Accessibility**
  - Keyboard navigation throughout
  - Screen reader friendly
  - Focus indicators
  - Voice input as alternative input method
  - Clear visual feedback for all actions

## Configuration

- shell: false

## Technical Notes

- **Data Model**: Deferred to Charter - The data structure for user onboarding preferences, habits, journaling configuration, and relationships will be defined by Charter during implementation.
