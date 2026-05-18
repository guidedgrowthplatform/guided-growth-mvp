export interface SessionStateDeltaEntry {
  id: string;
  session_id: string;
  timestamp: string;
  event_type: string;
  screen_id: string | null;
  payload: Record<string, unknown> | null;
}

export interface ScreenContextBlock {
  screen_id: string;
  context_block: string;
  version: number;
}

export interface SessionStateDeltaResponse {
  state_delta: SessionStateDeltaEntry[];
}

export interface ScreenContext extends ScreenContextBlock {
  state_delta: SessionStateDeltaEntry[];
}
