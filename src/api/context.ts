import { apiGet } from './client';

export interface ScreenRouteEntry {
  screen_id: string;
  route: string;
}

export function fetchScreenRoutes(): Promise<{ routes: ScreenRouteEntry[] }> {
  return apiGet<{ routes: ScreenRouteEntry[] }>('/api/context/routes');
}

export interface ScreenContextBlock {
  screen_id: string;
  context_block: string;
  version: number;
}

export interface SessionStateDeltaEntry {
  id: string;
  session_id: string;
  timestamp: string;
  event_type: string;
  screen_id: string | null;
  payload: Record<string, unknown> | null;
}

export interface SessionStateDeltaResponse {
  state_delta: SessionStateDeltaEntry[];
}

export interface ScreenContext extends ScreenContextBlock {
  state_delta: SessionStateDeltaEntry[];
}

export function fetchScreenContextBlock(screenId: string): Promise<ScreenContextBlock> {
  const params = new URLSearchParams({ screen_id: screenId });
  return apiGet<ScreenContextBlock>(`/api/context?${params.toString()}`);
}

export function fetchSessionStateDelta(sinceTs: string): Promise<SessionStateDeltaResponse> {
  const params = new URLSearchParams({ since_ts: sinceTs });
  return apiGet<SessionStateDeltaResponse>(`/api/context/state?${params.toString()}`);
}
