# Core Tracking & Progress Specification

## Overview

The foundation of Guided Growth App - seamless daily data entry for habit tracking, journaling, and progress viewing. Users can log habits, track consistency, maintain streaks, journal their reflections, and view their progress through form or spreadsheet views with multi-modal input support. This section handles all daily data capture, habit management, journaling management, and progress reporting after the initial onboarding is complete.

**Note:** Basic speech-to-text (converting voice to text) - if easy to implement, include it here. If not, it will be handled in the AI Voice section (Section 3). Full AI Voice features (conversational AI, voice coaching, intelligent voice interactions) are always handled in the AI Voice section.

## User Flows

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
