# Core Tracking & Onboarding Specification

## Overview

The foundation of Guided Growth App - a comprehensive onboarding flow that personalizes each user's habit tracking and journaling system without requiring manual configuration, followed by seamless daily data entry. Users finish onboarding with their habits defined, journaling format configured, and can immediately start logging data. The system supports multi-modal input (text, basic speech-to-text, copy-paste) throughout, and provides immediate value from day one with no empty states or additional setup required.

**Note:** Basic speech-to-text (converting voice to text) is included in this section. Full AI Voice features (conversational AI, voice coaching, intelligent voice interactions) are handled in the AI Voice section (Section 2).

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

### Daily Data Entry Flow

1. **Access Capture Page**
   - User navigates to daily capture (default landing after onboarding)
   - Sees current date selected
   - View mode matches their preference (Form or Spreadsheet)

2. **Form View Entry**
   - Shows only metrics due for selected date (based on frequency)
   - Clean, focused interface
   - Binary metrics: Yes/No buttons
   - Numeric metrics: Number input
   - Text metrics: Textarea
   - Journal sections: Textareas with auto-numbering
   - Affirmation: Displayed for reading
   - Save button commits all entries

3. **Spreadsheet View Entry**
   - Calendar grid showing all days in selected month
   - Rows for each active metric
   - Columns for each day
   - Inline editing for text/time cells
   - Popup editor for binary/numeric cells
   - Visual indicators for cell values
   - Copy/paste support
   - Keyboard navigation (arrow keys, tab, enter)

4. **Date Navigation**
   - Month/Year selector
   - Previous/Next month navigation
   - Current date highlighting
   - Can navigate to any date to view/edit past entries

5. **Multi-Modal Input**
   - At any input field: Type, copy-paste, or basic speech-to-text
   - Basic speech-to-text: Voice converted to text and handled identically to typed input
   - Note: This is basic voice-to-text conversion, not full AI Voice features (see AI Voice section)
   - Reduces friction, supports verbal thinkers, improves accessibility

### Habit Management Flow

1. **View Habits**
   - See all configured habits in list
   - Visual indicators for active/inactive
   - See frequency and type for each

2. **Edit Habit**
   - Double-click or edit button
   - Modify name, question, input type, frequency, active status
   - Changes saved immediately

3. **Add New Habit**
   - Add habit button
   - Configure: name, question (optional), input type, frequency
   - Auto-capitalized name
   - Immediately available for tracking

4. **Delete/Deactivate Habit**
   - Delete removes permanently
   - Deactivate hides without deleting
   - Can reactivate later

5. **Reorder Habits**
   - Drag and drop to reorder
   - Order persists across sessions

### Journaling Management Flow

1. **View Journal Sections**
   - See all active journal sections
   - Default: Proud of, Grateful for, Forgive myself for

2. **Edit Journal Section Label**
   - Double-click label to edit
   - Inline editing with input field
   - Saves on blur or Enter

3. **Add Custom Journal Section**
   - Add section button
   - Enter custom label
   - Immediately available for daily entry

4. **Disable Journal Section**
   - Toggle to hide section
   - Can re-enable later
   - Data preserved

## UI Requirements

- **Onboarding Flow**
  - Step-by-step wizard interface
  - Progress indicator showing current step
  - Can navigate back to previous steps
  - Multi-modal input support at every stage (text, basic speech-to-text, copy-paste)
  - Clean, focused design that doesn't overwhelm beginners
  - Smart defaults with customization options

- **Capture Page - Form View**
  - Date selector at top (month/year picker, prev/next buttons)
  - View mode toggle (Form/Spreadsheet) at top
  - Only shows metrics due for selected date (respects frequency: daily, weekdays, weekends, weekly)
  - Binary metrics: Large Yes/No buttons, clear visual feedback
  - Numeric metrics: Number input with appropriate constraints
  - Text metrics: Textarea with auto-resize
  - Journal sections: Textareas with auto-numbering (starts with "1. " on focus, adds next number on Enter)
  - Affirmation display: Prominent, readable format
  - Save button: Commits all entries, provides feedback on save
  - Empty state: None - onboarding ensures everything is configured

- **Capture Page - Spreadsheet View**
  - Calendar grid layout: rows = metrics, columns = days
  - Month navigation at top
  - Current date highlighted
  - Cell editing:
    - Text/Time: Inline editing (single click, input appears in cell)
    - Binary/Numeric: Popup editor (double-click, popup appears to right of cell)
  - Cell value display:
    - Binary: 'yes' = '1' (green), 'no' = '0' (red), empty = '-' (gray)
    - Numeric: Value > 0 (green), Value = 0 (red), empty = '-' (gray)
    - Text/Time: Value as-is, auto-resized to fit (min 6px, max 12px font)
  - Selection: Click to select, Shift+Click for range, visual feedback (blue border)
  - Keyboard navigation: Arrow keys, Tab, Enter, Delete, Copy/Paste (Ctrl+C/V)
  - Fill handle: Visual indicator, drag to fill range

- **Habit Configuration Page**
  - List of all habits with drag-and-drop reordering
  - Each habit shows: name, question, input type, frequency, active/inactive toggle
  - Add habit button/interface
  - Edit: Double-click or edit button
  - Delete: Delete button with confirmation
  - Active/Inactive toggle visible on each habit

- **Journaling Configuration**
  - List of active journal sections
  - Each section: editable label, enable/disable toggle
  - Add custom section interface
  - Changes save immediately

- **Multi-Modal Input**
  - Voice input button/icon available at all text inputs
  - Basic speech-to-text conversion (voice-to-text, not AI Voice features)
  - Visual feedback during voice input (recording indicator)
  - Copy-paste works seamlessly in all text fields
  - Note: Full AI Voice features (conversational AI, voice coaching) are in AI Voice section

- **Date Navigation**
  - Month/Year picker: Dropdown or calendar picker
  - Previous/Next month buttons
  - Current date clearly highlighted
  - Can navigate to any date (past or future)

- **Responsive Design**
  - Mobile-friendly layouts
  - Touch-optimized interactions
  - Keyboard shortcuts work on desktop
  - Voice input accessible on mobile

- **Data Persistence**
  - All changes save immediately (auto-save)
  - No "Save" button required (except Form view which has explicit Save)
  - LocalStorage persistence
  - Data persists across sessions

- **Accessibility**
  - Keyboard navigation throughout
  - Screen reader friendly
  - Focus indicators
  - Voice input as alternative input method
  - Clear visual feedback for all actions

## Configuration

- shell: true

## Technical Notes

- **Data Model**: Deferred to Charter - The data structure for habits, journal entries, user data, and relationships will be defined by Charter during implementation.
