import type { JournalEntry } from '@shared/types';

export function htmlToPlainText(html: string): string {
  if (!html) return '';
  const withSpacing = html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|blockquote)\s*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ');
  const stripped = withSpacing.replace(/<[^>]+>/g, '');
  const decoded = stripped
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
}

export function getEntryPreview(entry: Pick<JournalEntry, 'fields' | 'title'>): string {
  const fields = entry.fields ?? {};
  const body = fields.body ?? fields.reflection;
  if (body && body.trim()) return htmlToPlainText(body);

  const nonEmpty = Object.entries(fields)
    .map(([, v]) => (typeof v === 'string' ? htmlToPlainText(v) : ''))
    .filter((v) => v.trim().length > 0);

  if (nonEmpty.length > 0) return nonEmpty.slice(0, 2).join(' · ');
  return entry.title?.trim() ?? '';
}
