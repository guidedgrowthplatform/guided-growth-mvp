import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { InputMethodContext } from '@/contexts/inputMethodContextDef';
import type { InputMethod } from '@/contexts/inputMethodContextDef';

/**
 * Provider for input method tracking — central store for whether the
 * user's last interaction was voice (mic) or manual (tap/type).
 *
 * Per PostHog Analytics Plan §1.3: every user-facing action fires ONE
 * event with an `input_method` property rather than separate voice /
 * manual events. Components firing track() calls read from this context
 * so the property is consistent across the app.
 *
 * Set the value on the edge:
 *   - Mic handler  → setInputMethod('voice')
 *   - Button/form  → setInputMethod('manual')
 *
 * Voice values auto-decay back to 'manual' after `idleResetMs` so a
 * stale voice signal doesn't leak into the next manual action.
 */
interface InputMethodProviderProps {
  children: ReactNode;
  /** Ms after which a 'voice' value decays back to 'manual'. Default 3000. */
  idleResetMs?: number;
}

export function InputMethodProvider({ children, idleResetMs = 3000 }: InputMethodProviderProps) {
  const [inputMethod, setInputMethodState] = useState<InputMethod>('manual');
  const decayTimerRef = useRef<number | null>(null);

  const setInputMethod = useCallback(
    (next: InputMethod) => {
      setInputMethodState(next);
      if (decayTimerRef.current !== null) {
        window.clearTimeout(decayTimerRef.current);
        decayTimerRef.current = null;
      }
      if (next === 'voice') {
        decayTimerRef.current = window.setTimeout(() => {
          setInputMethodState('manual');
          decayTimerRef.current = null;
        }, idleResetMs);
      }
    },
    [idleResetMs],
  );

  const value = useMemo(() => ({ inputMethod, setInputMethod }), [inputMethod, setInputMethod]);

  return <InputMethodContext.Provider value={value}>{children}</InputMethodContext.Provider>;
}
