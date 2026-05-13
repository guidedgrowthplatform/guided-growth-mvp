import { createContext } from 'react';

export interface SessionLogContextValue {
  sessionId: string;
  logEvent: <E extends string>(
    event_type: E,
    payload?: Record<string, unknown>,
    screen_id?: string,
  ) => void;
  startVoice: (screen_id?: string, extra?: Record<string, unknown>) => string;
  endVoice: (anchor_id: string, reason: string, extra?: Record<string, unknown>) => void;
}

export const SessionLogContext = createContext<SessionLogContextValue | null>(null);
