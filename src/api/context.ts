import type {
  ScreenContext,
  ScreenContextBlock,
  SessionStateDeltaEntry,
  SessionStateDeltaResponse,
} from '@shared/types/context.js';
import { apiGet } from './client';

export type {
  ScreenContext,
  ScreenContextBlock,
  SessionStateDeltaEntry,
  SessionStateDeltaResponse,
};

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
