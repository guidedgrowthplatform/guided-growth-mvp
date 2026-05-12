import { apiGet } from './client';

export interface ScreenRouteEntry {
  screen_id: string;
  route: string;
}

export function fetchScreenRoutes(): Promise<{ routes: ScreenRouteEntry[] }> {
  return apiGet<{ routes: ScreenRouteEntry[] }>('/api/context/routes');
}
