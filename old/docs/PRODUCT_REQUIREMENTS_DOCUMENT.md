# Life Growth Tracker - Product Requirements Document (PRD)

**Version:** 1.0.9.2  
**Last Updated:** January 8, 2026  
**Document Type:** Comprehensive Feature & Behavior Specification

---

## Table of Contents

1. [Overview](#overview)
2. [Core Features](#core-features)
3. [User Management](#user-management)
4. [Data Entry & Capture](#data-entry--capture)
5. [User Interface & Navigation](#user-interface--navigation)
6. [Data Management](#data-management)
7. [Keyboard Shortcuts & Interactions](#keyboard-shortcuts--interactions)
8. [Input Field Behaviors](#input-field-behaviors)
9. [Known Issues & Bug Patterns](#known-issues--bug-patterns)
10. [Critical Rules & Constraints](#critical-rules--constraints)
11. [Edge Cases & Special Behaviors](#edge-cases--special-behaviors)
12. [Technical Requirements](#technical-requirements)

---

## Overview

### Product Description
Life Growth Tracker is a web-based habit and personal metric tracking application that allows users to record daily habits, reflections, and personal growth metrics. The application supports multiple users, multiple view modes, and comprehensive data management features.

### Key Value Propositions
- **Multi-User Support**: Separate data isolation for different users (Yair, Charter, etc.)
- **Dual View Modes**: Form view for focused entry, Spreadsheet view for bulk editing
- **Comprehensive Tracking**: Support for binary, numeric, text, and time-based metrics
- **Reflection System**: Daily reflection fields (PROUD, FORGIVE, GRATEFUL) with auto-numbering
- **Data Persistence**: All data stored locally in browser localStorage
- **Keyboard-Driven Workflow**: Extensive keyboard shortcuts for power users

---

## Core Features

### 1. Metric/Habit Configuration
**Location:** `/configure` (KpiConfig page)

#### Features:
- **Create Metrics**: Add new habits/metrics with the following properties:
  - Name (text input, auto-capitalized)
  - Question (optional text input)
  - Input Type: `binary`, `numeric`, `short_text`, `text`, `time`
  - Frequency: `daily`, `weekdays`, `weekends`, `weekly`
  - Active/Inactive toggle
- **Edit Metrics**: Double-click or edit button to modify existing metrics
- **Delete Metrics**: Remove metrics from tracking
- **Reorder Metrics**: Drag and drop to reorder habits in the list
- **Active/Inactive Toggle**: Show/hide metrics without deleting them

#### Input Types:
1. **Binary (Yes/No)**: Stores `'yes'` or `'no'` values
2. **Numeric**: Stores numeric values (integers or decimals)
3. **Short Text**: Stores short text responses
4. **Text**: Stores longer text responses (used for time-based entries like "Wake up time")
5. **Time**: Stores time values (e.g., "9:30")

#### Frequency Types:
- **Daily**: Appears every day
- **Weekdays**: Appears Monday-Friday only
- **Weekends**: Appears Saturday-Sunday only
- **Weekly**: Appears once per week (first day of week or if no entry exists for that week)

### 2. Data Capture
**Location:** `/capture` (Capture page)

#### View Modes:
1. **Form View**: 
   - Shows only metrics due for selected date
   - Clean, focused interface for daily entry
   - Binary metrics show Yes/No buttons
   - Numeric metrics show number input
   - Text metrics show textarea
   - Save button to commit all entries

2. **Spreadsheet View**:
   - Calendar grid showing all days in selected month
   - Rows for each active metric
   - Columns for each day
   - Inline editing for text/time cells
   - Popup editor for binary/numeric cells
   - Visual indicators for cell values

#### Date Navigation:
- Month/Year selector
- Previous/Next month navigation
- Current date highlighting
- Date-specific reflection navigation

### 3. Report & Visualization
**Location:** `/report` (Report page)

#### Features:
- Calendar-style grid view
- Color-coded cells based on metric type and value
- Month navigation
- Visual progress tracking

---

## User Management

### Multi-User Support
**Default Users:**
- `yair`: Primary user with 15 predefined habits
- `charter`: Secondary user with 8 predefined habits

### User Features:
- **User Switching**: Dropdown selector in hamburger menu
- **Data Isolation**: Each user has completely separate data:
  - Metrics: `life_tracker_metrics_{userId}`
  - Entries: `life_tracker_entries_{userId}`
  - Reflections: `life_tracker_reflections_{userId}`
  - Reflection Config: `life_tracker_reflection_config_{userId}`
  - Affirmations: `life_tracker_affirmation_{userId}`
  - View Preferences: `life_tracker_view_preference_{userId}`

### User Initialization:
- **Yair**: Initializes with 15 specific habits (Wake up, Making bed, Meditation, etc.)
- **Charter**: Initializes with 8 specific habits (weed, mushies, alcohol, location, etc.)
- **Other Users**: Initialize with sample data (Exercise, Water Intake, Gratitude, Weekly Review)

### User Switching Behavior:
- Page reloads when switching users to ensure clean state
- Previous user's data is preserved
- New user's data loads automatically
- View preferences are user-specific

---

## Data Entry & Capture

### Cell Editing Modes

#### 1. Inline Editing (Text/Time Inputs)
- **Trigger**: Single click on text/time cell
- **Behavior**: 
  - Input appears directly in cell
  - Auto-focuses and selects all text
  - Saves on blur or Enter key
  - Escape cancels editing
  - Enter moves to next row (down)

#### 2. Popup Editing (Binary/Numeric Inputs)
- **Trigger**: Double-click on binary/numeric cell
- **Behavior**:
  - Popup appears to the right of cell
  - Positioned at top-right corner of cell
  - Auto-focuses input
  - Saves on Enter or click outside
  - Escape cancels

### Cell Value Display

#### Binary Metrics:
- `'yes'` → Displays `'1'` in green background
- `'no'` → Displays `'0'` in red background
- Empty → Displays `'-'` in gray background

#### Numeric Metrics:
- Value > 0 → Displays number in green background
- Value = 0 → Displays `'0'` in red background
- Empty → Displays `'-'` in gray background

#### Text/Time Metrics:
- Displays value as-is
- Auto-resizes text to fit cell
- Minimum font size: 6px
- Maximum font size: 12px

### Direct Input (Keyboard Typing)
- Type directly on selected cell to enter value
- For binary: `1` = yes, `0` = no
- For numeric: Direct number entry
- For text/time: Starts inline editing with typed character
- Auto-moves to next row after input

---

## User Interface & Navigation

### Layout Components

#### Hamburger Menu
- **Location**: Fixed top-left corner
- **Trigger**: Click hamburger icon (☰)
- **Behavior**:
  - Slides in from left
  - Overlay appears behind menu
  - Click overlay to close
  - Animated transitions
  - Contains:
    - App title and version
    - User selector dropdown
    - Navigation links (Capture, Configure, Report)

#### Navigation
- **Routes**:
  - `/capture` - Data entry page
  - `/configure` - Metric configuration page
  - `/report` - Report/visualization page
- **Active State**: Highlighted with gradient background
- **Icons**: 📝 Capture, ⚙️ Configure, 📊 Report

### View Mode Toggle
- **Location**: Top of Capture page
- **Options**: "Form View" and "Spreadsheet View"
- **Behavior**: 
  - Preference saved per user
  - Persists across sessions
  - Stored in localStorage

### Date Selector
- **Location**: Top-right of Capture page
- **Options**: 
  - Month/Year picker
  - Previous/Next month buttons
- **Format**: "January 2026"

---

## Data Management

### Copy & Paste

#### Copy (Ctrl+C / Cmd+C)
- **Behavior**:
  - Copies selected cell(s) to clipboard
  - Supports single cell or range selection
  - Copies to system clipboard as tab-separated text
  - Stores in application state for internal paste

#### Paste (Ctrl+V / Cmd+V)
- **Behavior**:
  - Pastes from system clipboard if available
  - Supports tab-separated multi-column paste
  - Pastes starting from selected cell
  - Handles multi-row paste (one value per row)
  - Auto-saves after paste

### Undo/Redo
- **Undo**: Ctrl+Z / Cmd+Z
- **Redo**: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z / Cmd+Shift+Z
- **History**: Maintains history of entry changes
- **Limitation**: Only tracks entry changes, not metric changes

### Delete
- **Delete Key**: Deletes value in selected cell(s)
- **Range Delete**: Deletes all values in selected range
- **Behavior**: Removes entry from localStorage

### Fill Handle
- **Visual Indicator**: Blue border on selected cell
- **Behavior**: Click and drag to fill range with same value
- **Limitation**: Only works for single cell selection

---

## Keyboard Shortcuts & Interactions

### Navigation
- **Arrow Keys**: Move selection up/down/left/right
- **Tab**: Move to next cell (right)
- **Shift+Tab**: Move to previous cell (left)
- **Enter**: 
  - In text/time cells: Save and move down
  - In reflection fields: Create new numbered line
- **Escape**: Cancel editing

### Data Entry
- **Type directly**: Enter value on selected cell
- **1/0**: Quick entry for binary (1=yes, 0=no)
- **Numbers**: Direct entry for numeric fields

### Actions
- **Ctrl+C / Cmd+C**: Copy selected cells
- **Ctrl+V / Cmd+V**: Paste
- **Ctrl+Z / Cmd+Z**: Undo
- **Ctrl+Y / Cmd+Y**: Redo
- **Ctrl+Shift+Z / Cmd+Shift+Z**: Redo (alternative)
- **Delete**: Delete selected cell value(s)

### Selection
- **Click**: Select single cell
- **Shift+Click**: Create range selection
- **Drag**: Create range selection
- **Click + Drag**: Multi-cell selection

---

## Input Field Behaviors

### Critical Rule: Selection Clearing
**REQUIREMENT**: When any input field (textarea, input, select) is clicked or focused, ALL spreadsheet selections must be cleared.

#### Implementation Requirements:
1. **Clear State Variables**:
   - `setSelectedCell(null)`
   - `setEditingCell(null)`
   - `setSelectionRange(null)`

2. **Stop Event Propagation**:
   - Call `e.stopPropagation()` on all input events
   - Prevents spreadsheet keyboard handlers from interfering

3. **Affected Input Types**:
   - Reflection textareas (PROUD, FORGIVE, GRATEFUL)
   - Affirmation textarea
   - Form view textareas
   - Form view number inputs
   - Form view text inputs
   - Inline cell text/time inputs
   - New habit form inputs (name, question)
   - Reflection field label inputs
   - User selector dropdown

### Reflection Field Auto-Numbering

#### PROUD, FORGIVE, GRATEFUL Fields

**On Focus (Empty Field)**:
- Automatically adds `"1. "` prefix
- Positions cursor after the number
- Saves to state immediately

**On Enter Key**:
- Finds all numbered lines in text
- Determines next number (highest + 1, or 2 if none)
- Inserts newline with next number (e.g., `"\n2. "`)
- Positions cursor after new number
- Auto-resizes textarea

**On Change (Typing)**:
- If user deletes all text and starts typing, adds `"1. "` back
- Only applies to single-line editing (not multi-line)
- Preserves cursor position when adding prefix

**On Blur (Empty/Number Only)**:
- If field is empty or only contains `"1. "` or `"1."`, clears completely
- Prevents saving placeholder numbers

**Numbering Logic**:
- Scans all lines for pattern: `^\d+\.\s`
- Extracts numbers from numbered lines
- Calculates next number: `max(numbers) + 1`
- Defaults to `2` if no numbered lines exist

### Affirmation Field
- Similar auto-numbering behavior
- Supports multi-line numbered lists
- Enter key adds next number on new line

### Text/Time Input Focus
- Auto-focuses when editing starts
- Selects all text on focus
- Positions cursor at end after auto-numbering

### Textarea Auto-Resize
- Automatically adjusts height based on content
- Minimum height: 60px
- Maximum: Based on scrollHeight
- Resizes on:
  - Content change
  - Paste
  - Focus
  - User switching

---

## Known Issues & Bug Patterns

### Issue #1: Selection Interference with Input Fields
**Status**: ✅ FIXED  
**Description**: When clicking on text inputs or textareas, spreadsheet selection remained active, preventing typing.

**Root Cause**: Spreadsheet keyboard handlers were intercepting key events even when user was typing in inputs.

**Solution**: 
- Clear all selection state on input focus/click
- Stop event propagation on all input events
- Prevent spreadsheet handlers from running when inputs are focused

**Prevention Rule**: All input fields MUST clear `selectedCell`, `editingCell`, and `selectionRange` on focus/click.

### Issue #2: Missing Auto-Numbering
**Status**: ✅ FIXED  
**Description**: Reflection fields (PROUD, FORGIVE, GRATEFUL) did not auto-number when pressing Enter.

**Root Cause**: Auto-numbering feature was removed in a previous version.

**Solution**: 
- Restored auto-numbering on Enter key
- Implemented number sequence detection
- Added automatic next number insertion

**Prevention Rule**: Reflection fields MUST auto-number on Enter key press.

### Issue #3: Wake-Up Time Input Not Working
**Status**: ✅ FIXED  
**Description**: Time input fields (like "Wake up time") were not focusable or editable.

**Root Cause**: Input focus handling was not properly implemented for inline text/time cells.

**Solution**:
- Added `useEffect` to focus inline input when editing starts
- Added `ref` to input element
- Implemented proper focus management

**Prevention Rule**: All inline editing inputs MUST auto-focus when editing mode starts.

### Issue #4: Missing UserContext
**Status**: ✅ FIXED  
**Description**: Application failed to load due to missing `UserContext` import.

**Root Cause**: UserContext file was not created during initial setup.

**Solution**: Created complete UserContext with UserProvider and useUser hook.

**Prevention Rule**: All required context files MUST exist before importing.

### Issue #5: Missing Storage Functions
**Status**: ✅ FIXED  
**Description**: Multiple storage functions were missing (capitalizeHabitName, reflection functions, etc.).

**Root Cause**: Functions were removed or never implemented.

**Solution**: Restored all missing functions from previous working version.

**Prevention Rule**: All imported functions MUST exist in their respective modules.

### Issue #6: Spreadsheet Selection Persisting in Reflection Fields
**Status**: ✅ FIXED  
**Description**: When clicking on PROUD/FORGIVE/GRATEFUL boxes, spreadsheet cells remained highlighted.

**Root Cause**: Selection state was not cleared when focusing reflection textareas.

**Solution**: Added selection clearing to all reflection field event handlers.

**Prevention Rule**: All input interactions MUST clear spreadsheet selection state.

---

## Critical Rules & Constraints

### Rule #1: Input Field Isolation
**Priority**: CRITICAL  
**Rule**: When ANY input field (textarea, input, select) receives focus or click:
1. Clear `selectedCell`
2. Clear `editingCell` 
3. Clear `selectionRange`
4. Call `e.stopPropagation()`

**Rationale**: Prevents spreadsheet keyboard handlers from interfering with text input.

### Rule #2: Data Persistence
**Priority**: CRITICAL  
**Rule**: All data changes MUST be saved to localStorage immediately upon change.

**Implementation**:
- Entry changes: Save immediately via `saveEntry()`
- Metric changes: Save immediately via `saveMetrics()`
- Reflection changes: Save immediately via `saveReflections()`
- No "Save" button required (auto-save)

### Rule #3: User Data Isolation
**Priority**: CRITICAL  
**Rule**: Each user's data MUST be completely isolated using userId prefixes in localStorage keys.

**Format**: `{prefix}_{userId}`

**Examples**:
- `life_tracker_metrics_yair`
- `life_tracker_entries_charter`
- `life_tracker_reflections_yair`

### Rule #4: Auto-Numbering for Reflection Fields
**Priority**: HIGH  
**Rule**: PROUD, FORGIVE, and GRATEFUL fields MUST:
1. Auto-add `"1. "` on focus if empty
2. Auto-add next number on Enter key
3. Clear placeholder numbers on blur if empty
4. Restore numbering if user starts typing after deleting

### Rule #5: Cell Value Formatting
**Priority**: HIGH  
**Rule**: Cell values MUST be formatted according to input type:
- Binary: `'yes'`/`'no'` stored, `'1'`/`'0'` displayed
- Numeric: Number stored and displayed
- Text/Time: String stored and displayed as-is
- Empty: `'-'` displayed in gray

### Rule #6: Frequency-Based Display
**Priority**: HIGH  
**Rule**: Metrics MUST only appear on dates where they are "due" based on frequency:
- Daily: Always shown
- Weekdays: Monday-Friday only
- Weekends: Saturday-Sunday only
- Weekly: Once per week (first occurrence or if no entry exists)

### Rule #7: Habit Name Capitalization
**Priority**: MEDIUM  
**Rule**: All habit names MUST be automatically capitalized using `capitalizeHabitName()`:
- First letter of each word capitalized
- Handles special characters (parentheses, slashes)
- Applied on save and display

### Rule #8: View Preference Persistence
**Priority**: MEDIUM  
**Rule**: Each user's view mode preference (form/spreadsheet) MUST be saved and restored:
- Saved on change
- Restored on user switch
- Stored per user in localStorage

### Rule #9: Undo/Redo Scope
**Priority**: MEDIUM  
**Rule**: Undo/Redo MUST only track entry changes, not metric configuration changes.

**Limitation**: Metric changes are not undoable.

### Rule #10: Cell Selection Visual Feedback
**Priority**: MEDIUM  
**Rule**: Selected cells MUST show clear visual feedback:
- Blue border (1.75px solid #1a73e8)
- Outline offset: -1px
- Z-index elevation when selected

---

## Edge Cases & Special Behaviors

### Edge Case #1: Empty Cell Handling
**Behavior**: 
- Empty cells display `'-'` in gray
- Deleting a value sets it to empty
- Empty values are not stored in localStorage (removed from entries object)

### Edge Case #2: Weekend Auto-Fill (Yair)
**Behavior**: 
- Weekends (Saturday/Sunday) are automatically filled with `'-'` for all metrics
- Applied when initializing Yair's data
- Applied to current month only

### Edge Case #3: Location Field Auto-Population (Charter)
**Behavior**: 
- "location" field for Charter user auto-populates from previous day if empty
- Only applies to Charter user
- Only applies to "location" metric

### Edge Case #4: Weekly Frequency Logic
**Behavior**: 
- Shows on Monday (first day of week)
- Also shows if no entry exists for that week
- Checks all days in the week for existing entries
- Prevents duplicate weekly entries

### Edge Case #5: Multi-Column Paste
**Behavior**: 
- Detects tab-separated values in clipboard
- Uses first column for paste
- Pastes one value per row
- Handles external paste from Google Sheets, Excel, etc.

### Edge Case #6: Text Resizing in Cells
**Behavior**: 
- Text auto-resizes to fit cell width
- Minimum font size: 6px
- Maximum font size: 12px
- Measures text width and adjusts dynamically

### Edge Case #7: Reflection Field Label Editing
**Behavior**: 
- Double-click reflection field label to edit
- Inline editing with input field
- Saves on blur or Enter key
- Updates reflection config

### Edge Case #8: Copy from Previous Day
**Behavior**: 
- Refresh icon button on reflection fields
- Looks back up to 30 days for previous value
- Copies most recent non-empty value
- Auto-resizes textarea after copy

### Edge Case #9: Click Below Text in Textarea
**Behavior**: 
- Clicking near bottom of textarea (within 20px) adds new numbered item
- Calculates next number based on existing numbered lines
- Inserts at end of text

### Edge Case #10: User Switching with Unsaved Data
**Behavior**: 
- All data is auto-saved before user switch
- Page reloads to ensure clean state
- New user's data loads automatically
- Previous user's data is preserved

---

## Technical Requirements

### Storage Structure

#### localStorage Keys:
```
life_tracker_users
life_tracker_current_user
life_tracker_user_preferences
life_tracker_metrics_{userId}
life_tracker_entries_{userId}
life_tracker_reflections_{userId}
life_tracker_reflection_config_{userId}
life_tracker_affirmation_{userId}
life_tracker_view_preference_{userId}
```

#### Data Formats:

**Metric Structure**:
```javascript
{
  id: string,
  name: string,
  question: string,
  inputType: 'binary' | 'numeric' | 'short_text' | 'text' | 'time',
  frequency: 'daily' | 'weekdays' | 'weekends' | 'weekly',
  active: boolean
}
```

**Entry Structure**:
```javascript
{
  'yyyy-MM-dd': {
    'metricId': value
  }
}
```

**Reflection Structure**:
```javascript
{
  'yyyy-MM-dd': {
    'fieldId': 'text value'
  }
}
```

### Performance Requirements
- All operations must be synchronous (localStorage)
- No API calls or network requests
- Instant save/load operations
- Smooth scrolling and interactions
- Responsive to 60fps animations

### Browser Compatibility
- Modern browsers with localStorage support
- ES6+ JavaScript support
- CSS Grid and Flexbox support

### Accessibility Requirements
- Keyboard navigation support
- Focus indicators
- ARIA labels where appropriate
- Screen reader friendly (basic)

---

## Version History

### v1.0.9.2
- Fixed cell selection interference with inputs
- Restored auto-numbering for reflection fields
- Fixed wake-up time input focus
- Improved input field isolation

### v1.0.9.1
- Added hamburger menu
- Removed auto-numbering (later restored)
- Updated cell coloring (0=red, >0=green)
- Multi-user support

### v1.0.9.0
- Initial multi-user implementation
- User context and management
- Data isolation per user

---

## Future Considerations

### Potential Enhancements
1. Data export/import (CSV, JSON)
2. Cloud sync capability
3. Mobile app version
4. Data visualization charts
5. Goal setting and tracking
6. Reminder notifications
7. Data analytics and insights
8. Custom themes
9. Multi-language support
10. Data backup/restore

### Technical Debt
1. Consider migrating to IndexedDB for larger datasets
2. Add unit tests for critical functions
3. Implement error boundaries
4. Add loading states for better UX
5. Optimize re-renders with React.memo
6. Add TypeScript for type safety

---

## Document Maintenance

**Update Frequency**: After each major feature addition or bug fix  
**Review Cycle**: Monthly  
**Owner**: Development Team  
**Stakeholders**: Product Owner, Developers, QA

---

**End of Document**

