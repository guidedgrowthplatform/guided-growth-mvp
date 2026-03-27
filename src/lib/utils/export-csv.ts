import type {
  Habit,
  CheckInRecord,
  JournalEntry,
  FocusSession,
  HabitCompletion,
} from '@/lib/services/data-service.interface';
import { getDataService } from '@/lib/services/service-provider';

/** Escape a CSV field value: wrap in quotes if it contains comma, newline, or quote. */
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a CSV block from headers and rows. */
function buildCSVSection(
  sectionTitle: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines: string[] = [];
  lines.push(`=== ${sectionTitle} ===`);
  lines.push(headers.map(escapeCSV).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeCSV).join(','));
  }
  return lines.join('\n');
}

/** Build a habit name lookup map from an array of habits. */
function buildHabitNameMap(habits: Habit[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const h of habits) {
    map.set(h.id, h.name);
  }
  return map;
}

/** Format a date string for display, falling back to original if invalid. */
function formatDateSafe(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

/**
 * Fetch all user data and trigger a CSV file download in the browser.
 * Sections: Habits, Completions, Check-Ins, Journal Entries, Focus Sessions.
 */
export async function exportUserDataCSV(): Promise<void> {
  const ds = await getDataService();

  // Use a wide date range to capture all data
  const startDate = '2000-01-01';
  const endDate = '2099-12-31';

  // Fetch all data in parallel
  const [habits, checkIns, journalEntries, focusSessions] = await Promise.all([
    ds.getAllHabits(),
    ds.getCheckIns(startDate, endDate),
    ds.getJournalEntries(startDate, endDate),
    ds.getFocusSessions(startDate, endDate),
  ]);

  const habitNameMap = buildHabitNameMap(habits);

  // Fetch completions for all habits in parallel
  const allCompletions: (HabitCompletion & { habitName: string })[] = [];
  const completionResults = await Promise.all(habits.map((h) => ds.getCompletions(h.id)));
  for (let i = 0; i < habits.length; i++) {
    for (const c of completionResults[i]) {
      allCompletions.push({
        ...c,
        habitName: habits[i].name,
      });
    }
  }

  // Sort completions by date descending
  allCompletions.sort((a, b) => b.date.localeCompare(a.date));

  // Build CSV sections
  const sections: string[] = [];

  // === HABITS ===
  sections.push(
    buildCSVSection(
      'HABITS',
      ['Name', 'Frequency', 'Active', 'Created'],
      habits.map((h: Habit) => [
        h.name,
        h.frequency,
        h.active ? 'yes' : 'no',
        formatDateSafe(h.createdAt),
      ]),
    ),
  );

  // === COMPLETIONS ===
  sections.push(
    buildCSVSection(
      'COMPLETIONS',
      ['Date', 'Habit', 'CompletedAt'],
      allCompletions.map((c) => [c.date, c.habitName, formatDateSafe(c.completedAt)]),
    ),
  );

  // === CHECK-INS ===
  sections.push(
    buildCSVSection(
      'CHECK-INS',
      ['Date', 'Sleep', 'Mood', 'Energy', 'Stress'],
      checkIns.map((ci: CheckInRecord) => [ci.date, ci.sleep, ci.mood, ci.energy, ci.stress]),
    ),
  );

  // === JOURNAL ENTRIES ===
  sections.push(
    buildCSVSection(
      'JOURNAL ENTRIES',
      ['Date', 'Content', 'Mood'],
      journalEntries.map((je: JournalEntry) => [je.date, je.content, je.mood ?? '']),
    ),
  );

  // === FOCUS SESSIONS ===
  sections.push(
    buildCSVSection(
      'FOCUS SESSIONS',
      ['Date', 'Duration(min)', 'Actual(min)', 'Status', 'Habit'],
      focusSessions.map((fs: FocusSession) => [
        formatDateSafe(fs.startedAt),
        fs.durationMinutes,
        fs.actualMinutes,
        fs.status,
        habitNameMap.get(fs.habitId ?? '') ?? '',
      ]),
    ),
  );

  const csvContent = sections.join('\n\n') + '\n';

  // Trigger browser download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `my-data-export-${new Date().toISOString().split('T')[0]}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
