import type { JournalEntry, JournalEntryCreate, JournalEntryUpdate } from '@shared/types';
import { apiGet, apiPost, apiPut, apiDelete } from './client';

export function createJournalEntry(data: JournalEntryCreate): Promise<JournalEntry> {
  return apiPost<JournalEntry>('/api/reflections/entries', data);
}

export function fetchJournalEntries(start: string, end: string): Promise<JournalEntry[]> {
  return apiGet<JournalEntry[]>(`/api/reflections/entries?start=${start}&end=${end}`);
}

export interface FetchRecentJournalEntriesOptions {
  limit?: number;
  page?: number;
}

export function fetchRecentJournalEntries(
  options: FetchRecentJournalEntriesOptions = {},
): Promise<JournalEntry[]> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.page !== undefined) params.set('page', String(options.page));
  const qs = params.toString();
  return apiGet<JournalEntry[]>(`/api/reflections/entries${qs ? `?${qs}` : ''}`);
}

export function fetchJournalEntry(id: string): Promise<JournalEntry> {
  return apiGet<JournalEntry>(`/api/reflections/entries/${id}`);
}

export function updateJournalEntry(id: string, data: JournalEntryUpdate): Promise<JournalEntry> {
  return apiPut<JournalEntry>(`/api/reflections/entries/${id}`, data);
}

export function deleteJournalEntry(id: string): Promise<void> {
  return apiDelete<void>(`/api/reflections/entries/${id}`);
}

export function generateJournalInsight(id: string): Promise<{ ai_insight: string | null }> {
  return apiPost<{ ai_insight: string | null }>(`/api/reflections/entries/${id}/insight`, {});
}
