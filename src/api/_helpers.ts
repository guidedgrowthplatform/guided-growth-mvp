const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

/**
 * True when the project is wired against a real Supabase instance. In that
 * mode the legacy /api/* endpoints return 401 (auth is via Supabase Auth
 * directly), so callers should skip the network and use the local
 * DataService / localStorage equivalents.
 */
export const useSupabase = supabaseUrl.length > 0 && !supabaseUrl.includes('placeholder');

/**
 * Run `apiCall` against the legacy REST API; otherwise — or on error —
 * fall back to the DataService / localStorage path.
 */
export async function withDataServiceFallback<T>(
  apiCall: () => Promise<T>,
  fallback: () => Promise<T> | T,
): Promise<T> {
  if (useSupabase) return fallback();
  try {
    return await apiCall();
  } catch (err) {
    // Centralising this catch makes it tempting to leave it silent, but the
    // pre-refactor per-module catches were already silent — at least log so
    // a network outage or schema drift surfaces in DevTools rather than
    // disappearing behind locally-correct fallback data.
    console.warn('[api] falling back to DataService:', err);
    return fallback();
  }
}
