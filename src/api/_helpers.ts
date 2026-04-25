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
  } catch {
    return fallback();
  }
}
