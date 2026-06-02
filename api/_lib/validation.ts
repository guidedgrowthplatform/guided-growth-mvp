/** Date format: YYYY-MM-DD */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate that a string is a valid YYYY-MM-DD date.
 * Returns the sanitized date string or null if invalid.
 */
export function validateDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!DATE_REGEX.test(value)) return null;
  // Verify it's a real date (e.g., reject 2026-02-30)
  const parsed = new Date(value + 'T00:00:00Z');
  if (isNaN(parsed.getTime())) return null;
  // Round-trip check: ensure Date didn't silently fix the day
  const [y, m, d] = value.split('-').map(Number);
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() + 1 !== m ||
    parsed.getUTCDate() !== d
  ) {
    return null;
  }
  return value;
}

// RFC 4122 v4: version nibble `4`, variant nibble `[89ab]`.
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUUID(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return UUID_REGEX.test(value) ? value : null;
}

// IANA timezone → the zone, or null if invalid (Intl rejects unknown zones).
export function validateTimezone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return null;
  // Node 22+ Intl accepts UTC-offset identifiers (+HH:mm); IANA names only.
  if (/^[+-]/.test(value)) return null;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

/**
 * Get a safe client IP from Vercel headers.
 * x-real-ip is set by Vercel infrastructure and cannot be spoofed by clients.
 * Falls back to x-forwarded-for first entry, then 'unknown'.
 */
export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const realIp = headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() || 'unknown';
  return 'unknown';
}

import sanitizeHtml from 'sanitize-html';

const ALLOWED_HTML_TAGS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'hr', 'img', 'br'];
const ALLOWED_HTML_ATTRS: Record<string, string[]> = { img: ['src', 'alt'] };

/**
 * Sanitize HTML content to prevent XSS.
 * Only allows tags that Tiptap produces.
 */
export function sanitizeContent(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: ALLOWED_HTML_TAGS,
    allowedAttributes: ALLOWED_HTML_ATTRS,
    allowedSchemes: ['https'],
  });
}
