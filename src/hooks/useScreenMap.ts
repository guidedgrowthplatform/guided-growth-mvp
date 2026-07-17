import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchScreenRoutes, type ScreenRouteEntry } from '@/api/context';
import { resolveOnboardingBeatId } from '@gg/shared/onboarding/beatIds';

interface ScreenMap {
  routeToScreenId: (pathname: string) => string | null;
  entries: ScreenRouteEntry[];
  isLoaded: boolean;
}

interface Resolver {
  exact: Map<string, string>;
  patterns: Array<{ regex: RegExp; screenId: string }>;
}

// Routes that don't start with "/" or contain whitespace are sheet noise
// (e.g. "/home (state: checkin-expanded)"). Exclude from the resolver.
function isCleanRoute(route: string): boolean {
  return route.startsWith('/') && !/\s/.test(route);
}

// Convert "/habit/:id/edit" → /^\/habit\/[^/]+\/edit$/
function compilePattern(route: string): RegExp {
  const escaped = route.replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
  const parameterized = escaped.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '[^/]+');
  return new RegExp(`^${parameterized}$`);
}

function buildResolver(entries: ScreenRouteEntry[]): Resolver {
  const exact = new Map<string, string>();
  const patterns: Array<{ regex: RegExp; screenId: string }> = [];

  for (const entry of entries) {
    if (!isCleanRoute(entry.route)) continue;
    const hasParam = /:[A-Za-z_]/.test(entry.route);

    if (hasParam) {
      // Last-write-wins for patterns too — first entry sticks. We push only
      // if no equivalent pattern already exists.
      if (!patterns.some((p) => p.regex.source === compilePattern(entry.route).source)) {
        patterns.push({
          regex: compilePattern(entry.route),
          screenId: resolveOnboardingBeatId(entry.screen_id) ?? entry.screen_id,
        });
      }
    } else if (!exact.has(entry.route)) {
      // Multiple screen_ids share routes like "/home". First match wins;
      // per-screen code overrides by passing screen_id explicitly to
      // logEvent. The exact ordering comes from the SQL ORDER BY screen_id.
      exact.set(entry.route, resolveOnboardingBeatId(entry.screen_id) ?? entry.screen_id);
    }
  }

  return { exact, patterns };
}

export function useScreenMap(): ScreenMap {
  const query = useQuery({
    queryKey: ['screen-routes'],
    queryFn: fetchScreenRoutes,
    staleTime: Infinity,
    gcTime: Infinity,
    // The endpoint is public + cacheable; a failure here shouldn't poison the
    // app. Retry once on cold start, then give up — the emitter will fall
    // back to 'UNKNOWN' screen_ids until the next reload.
    retry: 1,
  });

  // Stable empty-array identity prevents resolver/useMemo churn when data is undefined.
  const entries = useMemo(() => query.data?.routes ?? [], [query.data?.routes]);

  const resolver = useMemo(() => buildResolver(entries), [entries]);

  const routeToScreenId = useMemo(() => {
    return (pathname: string): string | null => {
      const hit = resolver.exact.get(pathname);
      if (hit) return hit;
      for (const { regex, screenId } of resolver.patterns) {
        if (regex.test(pathname)) return screenId;
      }
      // "/home" is a legacy alias for "/" (both render HomePage). HOME-*
      // rows live at "/" in screen_contexts after route normalization, so a
      // visit to "/home" resolves through "/".
      if (pathname === '/home') return resolver.exact.get('/') ?? null;
      return null;
    };
  }, [resolver]);

  return { routeToScreenId, entries, isLoaded: query.isFetched };
}
