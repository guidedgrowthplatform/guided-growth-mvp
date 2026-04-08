import type { JournalEntry, JournalEntryCreate } from '@shared/types';
import { apiGet, apiPost, apiPut, apiDelete } from './client';

export function createJournalEntry(data: JournalEntryCreate): Promise<JournalEntry> {
  return apiPost<JournalEntry>('/api/reflections/journal', data);
}

export function fetchJournalEntries(start: string, end: string): Promise<JournalEntry[]> {
  return apiGet<JournalEntry[]>(`/api/reflections/journal?start=${start}&end=${end}`);
}

export function fetchJournalEntry(id: string): Promise<JournalEntry> {
  return apiGet<JournalEntry>(`/api/reflections/journal/${id}`);
}

export function updateJournalEntry(
  id: string,
  data: Partial<JournalEntryCreate>,
): Promise<JournalEntry> {
  return apiPut<JournalEntry>(`/api/reflections/journal/${id}`, data);
}

export function deleteJournalEntry(id: string): Promise<void> {
  return apiDelete<void>(`/api/reflections/journal/${id}`);
}
