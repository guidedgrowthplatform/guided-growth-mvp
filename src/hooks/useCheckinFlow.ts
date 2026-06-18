import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/chat/coachChatTypes';
import {
  type CheckinMode,
  flowSessionReducer,
  initialFlowSession,
  stageInfo,
} from '@/lib/checkin/checkinFlowMachine';
import { buildCheckinTranscript } from '@/lib/checkin/checkinTranscript';
import { SCRIPTED_CHECKIN_ENABLED } from '@/lib/config/checkin';
import { formatDate } from '@/utils/dates';

export interface CheckinFlowController {
  /** Scripted mode is on AND a check-in is active on this screen. */
  active: boolean;
  /** Which check-in is running. */
  mode: CheckinMode;
  /** Scripted coach bubbles (+ inline cards) emitted so far. */
  messages: ChatMessage[];
  /** Which interactive card to keep visible. */
  card: 'state' | 'habits' | null;
  /** The fixed reflection prompt being asked, if any. */
  reflectionPrompt: 'proud' | 'forgive' | 'grateful' | null;
  expectsInput: boolean;
  /** The whole ritual is complete. */
  terminal: boolean;
  /** Card reports how many items remain unanswered (0 auto-advances). */
  reportProgress: (remaining: number) => void;
  /** User said/tapped "done". */
  userDone: () => void;
  /** A reflection prompt was answered (after log_reflection lands). */
  answerReflection: () => void;
}

// Thin React glue over the pure stage machine + transcript builder. All flow
// logic lives in checkinFlowMachine / checkinTranscript (unit-tested); this only
// holds state, resets on re-entry, and auto-advances the terminal wrap.
export function useCheckinFlow(opts: {
  mode: CheckinMode | null;
  enabled: boolean;
}): CheckinFlowController {
  const active = SCRIPTED_CHECKIN_ENABLED && opts.enabled && opts.mode != null;
  const mode: CheckinMode = opts.mode ?? 'morning';
  const daySeed = formatDate(new Date());
  const flowKey = active ? `${mode}:${daySeed}` : '';

  const [session, setSession] = useState(() => initialFlowSession(mode));
  const [prevKey, setPrevKey] = useState(flowKey);
  // Derived-state reset: restart the ritual when the active mode/day changes.
  if (flowKey !== prevKey) {
    setPrevKey(flowKey);
    setSession(initialFlowSession(mode));
  }

  const lastRemaining = useRef<number>(Number.POSITIVE_INFINITY);

  const reportProgress = useCallback((remaining: number) => {
    lastRemaining.current = remaining;
    setSession((s) => flowSessionReducer(s, { type: 'PROGRESS', remaining }));
  }, []);
  const userDone = useCallback(() => {
    setSession((s) =>
      flowSessionReducer(s, { type: 'USER_DONE', remaining: lastRemaining.current }),
    );
  }, []);
  const answerReflection = useCallback(() => {
    setSession((s) => flowSessionReducer(s, { type: 'REFLECTION_ANSWERED' }));
  }, []);

  // The wrap line is shown, then the ritual is terminal.
  useEffect(() => {
    if (active && session.flow.stage === 'wrap') {
      setSession((s) => flowSessionReducer(s, { type: 'CONTINUE' }));
    }
  }, [active, session.flow.stage]);

  const messages = useMemo(
    () => (active ? buildCheckinTranscript(mode, session.visited, daySeed) : []),
    [active, mode, session.visited, daySeed],
  );

  const info = stageInfo(session.flow);
  return {
    active,
    mode,
    messages,
    card: info.card,
    reflectionPrompt: info.reflectionPrompt,
    expectsInput: info.expectsInput,
    terminal: info.terminal,
    reportProgress,
    userDone,
    answerReflection,
  };
}
