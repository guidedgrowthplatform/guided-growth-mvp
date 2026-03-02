import { apiGet, apiPut } from './client';
import type { EntriesMap, DayEntries } from '@shared/types';
import { mockDataService } from '@/lib/services/mock-data-service';

export async function fetchEntries(start: string, end: string): Promise<EntriesMap> {
  try {
    return await apiGet<EntriesMap>(`/api/entries?start=${start}&end=${end}`);
  } catch {
    // Fallback: build EntriesMap from MockDataService completions
    const habits = await mockDataService.getHabits();
    const entries: EntriesMap = {};

    for (const habit of habits) {
      const completions = await mockDataService.getCompletions(habit.id, start, end);
      for (const c of completions) {
        if (!entries[c.date]) entries[c.date] = {};
        entries[c.date][habit.id] = '1'; // binary: completed
      }
    }
    return entries;
  }
}

export async function saveEntries(date: string, dayEntries: DayEntries): Promise<void> {
  try {
    await apiPut(`/api/entries/${date}`, dayEntries);
  } catch {
    // Fallback: save completions to MockDataService
    for (const [metricId, value] of Object.entries(dayEntries)) {
      if (value === '1' || value === 'true') {
        await mockDataService.completeHabit(metricId, date);
      }
    }
    window.dispatchEvent(new CustomEvent('voice-data-changed'));
  }
}

export async function saveBulkEntries(entriesMap: EntriesMap): Promise<void> {
  try {
    await apiPut('/api/entries/bulk', entriesMap);
  } catch {
    for (const [date, dayEntries] of Object.entries(entriesMap)) {
      for (const [metricId, value] of Object.entries(dayEntries)) {
        if (value === '1' || value === 'true') {
          await mockDataService.completeHabit(metricId, date);
        }
      }
    }
    window.dispatchEvent(new CustomEvent('voice-data-changed'));
  }
}
