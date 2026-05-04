import { format, isToday, isYesterday, parseISO } from 'date-fns';
import type { JournalEntry } from '@shared/types';

const PREVIEW_MAX_CHARS = 180;

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function previewText(entry: JournalEntry): string {
  if (entry.type === 'freeform') {
    const body = entry.fields?.body ?? '';
    const plain = stripHtml(body);
    if (plain) return plain;
    return entry.title || 'Freeform reflection';
  }
  const firstAnswer = Object.values(entry.fields ?? {}).find((v) => v?.trim());
  return firstAnswer?.trim() || 'Daily reflection';
}

export function entryHeading(entry: JournalEntry): string {
  if (entry.type === 'freeform') return entry.title || 'Freeform reflection';
  return 'Daily Reflection';
}

export function truncate(value: string, max = PREVIEW_MAX_CHARS): string {
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}

// "TODAY, 08:30 PM" / "YESTERDAY, 10:15 PM" / "SATURDAY, FEB 28"
export function formatListLabel(createdAt: string): string {
  const d = parseISO(createdAt);
  if (isToday(d)) return `TODAY, ${format(d, 'hh:mm a')}`;
  if (isYesterday(d)) return `YESTERDAY, ${format(d, 'hh:mm a')}`;
  return format(d, 'EEEE, MMM d').toUpperCase();
}

// "Today · 4:32 PM" / "Yesterday" / "Monday" / "May 1"
export function formatHomeLabel(createdAt: string): string {
  const d = parseISO(createdAt);
  if (isToday(d)) return `Today · ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return 'Yesterday';
  const daysAgo = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo < 7) return format(d, 'EEEE');
  return format(d, 'MMM d');
}

export interface DetailHeader {
  monthYear: string;
  fullDate: string;
  time: string;
}

export function formatDetailHeader(createdAt: string): DetailHeader {
  const d = parseISO(createdAt);
  return {
    monthYear: format(d, 'MMMM yyyy'),
    fullDate: format(d, 'EEEE, MMMM d, yyyy'),
    time: format(d, 'hh:mm a'),
  };
}
