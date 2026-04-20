import { useContext } from 'react';
import { InputMethodContext } from '@/contexts/inputMethodContextDef';
import type { InputMethodContextValue } from '@/contexts/inputMethodContextDef';

/**
 * Read (and optionally set) the current input method.
 *
 * Safe to call outside an `<InputMethodProvider>` — returns 'manual'
 * and a no-op setter so analytics calls in tests / stories don't crash.
 */
export function useInputMethod(): InputMethodContextValue {
  const ctx = useContext(InputMethodContext);
  if (!ctx) {
    return {
      inputMethod: 'manual',
      setInputMethod: () => {},
    };
  }
  return ctx;
}
