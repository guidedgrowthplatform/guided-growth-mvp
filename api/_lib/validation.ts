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

/** Validate UUID v4 format */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUID(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return UUID_REGEX.test(value) ? value : null;
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
