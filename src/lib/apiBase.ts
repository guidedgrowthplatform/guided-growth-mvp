/**
 * Optional override for the app's own /api/** base URL, read on every
 * platform (web and native). This is separate from VITE_API_URL, which only
 * applies on native builds (see src/api/client.ts and friends) and always
 * leaves web on same-origin.
 *
 * Unset (the default) returns undefined, so every call site that checks this
 * first and falls through to its existing logic is byte-identical to before
 * this file existed.
 */
export function apiBaseOverride(): string | undefined {
  return (import.meta.env.VITE_API_BASE as string | undefined) || undefined;
}
