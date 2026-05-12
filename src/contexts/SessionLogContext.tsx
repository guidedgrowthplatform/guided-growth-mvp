import { createContext } from 'react';

export interface SessionLogContextValue {
  sessionId: string;
  logEvent: <E extends string>(
    event_type: E,
    payload?: Record<string, unknown>,
    screen_id?: string,
  ) => void;
}

export const SessionLogContext = createContext<SessionLogContextValue | null>(null);
