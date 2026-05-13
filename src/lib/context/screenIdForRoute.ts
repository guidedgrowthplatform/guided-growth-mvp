/**
 * Resolves a browser pathname to a canonical screen_id. Routes come from
 * `/api/context/routes` (mirror of the screen_contexts table).
 *
 * Static routes are matched verbatim; dynamic segments (`:param`) match any
 * single path component. Static matches win when both could apply, so a
 * specific page like `/habit/list` resolves to its own screen rather than
 * the catch-all `/habit/:habitId`.
 */
import type { ScreenRouteEntry } from '@/api/context';

function buildPattern(route: string): RegExp {
  const escaped = route.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:[^/]+/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

export function screenIdForRoute(
  routes: readonly ScreenRouteEntry[],
  pathname: string,
): string | null {
  for (const r of routes) {
    if (!r.route.includes(':') && r.route === pathname) return r.screen_id;
  }
  for (const r of routes) {
    if (r.route.includes(':') && buildPattern(r.route).test(pathname)) return r.screen_id;
  }
  return null;
}
