# Core Tracking

Daily data entry for habit tracking, journaling, and progress viewing. Covers all post-onboarding capture, habit management, and journaling management.

> Shared UX (multi-modal input, responsive, accessibility, persistence) lives in [../conventions.md](../conventions.md). This spec only covers behaviors specific to core tracking.

## User Flows

### Daily Data Entry

1. **Access capture page**
   - Default landing after onboarding
   - Current date selected
   - View mode matches user preference (Form or Spreadsheet)

2. **Form view entry**
   - Shows only metrics due for the selected date (respects frequency: daily, weekdays, weekends, weekly)
   - Binary metrics: Yes/No buttons
   - Numeric metrics: number input
   - Text metrics: textarea
   - Journal sections: textareas with auto-numbering (starts with `1. ` on focus, adds next number on Enter)
   - Affirmation: displayed for reading
   - Save button commits all entries

3. **Spreadsheet view entry**
   - Calendar grid: rows = active metrics, columns = days
   - Inline editing for text/time cells; popup editor for binary/numeric cells
   - Visual indicators per cell type (see UI below)
   - Copy/paste, keyboard navigation (arrows, Tab, Enter)

4. **Date navigation**
   - Month/Year selector + Previous/Next buttons
   - Current date highlighted
   - Navigate to any past or future date to view/edit

### Habit Management

1. **View habits** — list with active/inactive indicators, frequency, and type
2. **Edit habit** — double-click or edit button; modify name, question, input type, frequency, active status; saves immediately
3. **Add habit** — name (auto-capitalized), optional question, input type, frequency
4. **Delete or deactivate** — delete is permanent; deactivate hides without deleting; reactivatable
5. **Reorder** — drag-and-drop; order persists across sessions

### Journaling Management

1. **View sections** — defaults: "Proud of", "Grateful for", "Forgive myself for"
2. **Edit label** — double-click to edit inline; saves on blur or Enter
3. **Add custom section** — enter label; immediately available
4. **Disable section** — toggle to hide; data preserved; can re-enable

## UI Requirements (Specific to Core Tracking)

### Capture Page — Form View

- Date selector at top (month/year picker, prev/next)
- View mode toggle (Form/Spreadsheet) at top
- Only metrics due for the selected date appear
- Binary: large Yes/No buttons with clear visual feedback
- Numeric: number input with appropriate constraints
- Text: textarea with auto-resize
- Journal: textareas with auto-numbering
- Affirmation: prominent, readable
- Save button: explicit save with feedback
- Empty state: none — onboarding ensures everything is configured

### Capture Page — Spreadsheet View

- Grid: rows = metrics, columns = days
- Month navigation at top, current date highlighted
- Cell editing:
  - Text/Time: inline (single click)
  - Binary/Numeric: popup editor (double-click; popup to right of cell)
- Cell value display:
  - Binary: `yes` = `1` (green), `no` = `0` (red), empty = `-` (gray)
  - Numeric: value > 0 (green), value = 0 (red), empty = `-` (gray)
  - Text/Time: value as-is, auto-resized to fit (min 6px, max 12px font)
- Selection: click to select, Shift+Click for range, blue border feedback
- Keyboard: arrows, Tab, Enter, Delete, Copy/Paste (Ctrl+C/V)
- Fill handle: visual indicator, drag to fill range

### Habit Configuration Page

- List with drag-and-drop reordering
- Each row: name, question, input type, frequency, active/inactive toggle
- Add habit button
- Edit: double-click or edit button
- Delete: button with confirmation

### Journaling Configuration

- List of active sections
- Each: editable label, enable/disable toggle
- Add custom section interface
- Changes save immediately
