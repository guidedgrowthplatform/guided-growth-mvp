import { apiGet } from './client';

export type {
  ScreenContextBlock,
  SessionStateDeltaEntry,
  SessionStateDeltaResponse,
  ScreenContext,
} from '@shared/types/context.js';

import type {
  ScreenContextBlock,
  SessionStateDeltaResponse,
} from '@shared/types/context.js';

export interface ScreenRouteEntry {
  screen_id: string;
  route: string;
}

export function fetchScreenRoutes(): Promise<{ routes: ScreenRouteEntry[] }> {
  return apiGet<{ routes: ScreenRouteEntry[] }>('/api/context/routes');
}

export function fetchScreenContextBlock(screenId: string): Promise<ScreenContextBlock> {
  const params = new URLSearchParams({ screen_id: screenId });
  return apiGet<ScreenContextBlock>(`/api/context?${params.toString()}`);
}

export function fetchSessionStateDelta(sinceTs: string): Promise<SessionStateDeltaResponse> {
  const params = new URLSearchParams({ since_ts: sinceTs });
  return apiGet<SessionStateDeltaResponse>(`/api/context/state?${params.toString()}`);
}
