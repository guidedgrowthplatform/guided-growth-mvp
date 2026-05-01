import { createContext } from 'react';

export type InputMethod = 'voice' | 'manual';

export interface InputMethodContextValue {
  inputMethod: InputMethod;
  /** Set the current input method. Setting to 'voice' auto-decays back
   * to 'manual' after an idle window so stale values don't leak into
   * the next manual interaction. */
  setInputMethod: (next: InputMethod) => void;
}

export const InputMethodContext = createContext<InputMethodContextValue | null>(null);

// Module-scoped mirror of the active input_method so non-React code paths
// (analytics track() in particular) can attach the property without
// threading a hook through every call site. The Provider keeps this in
// sync; readers default to 'manual' when no Provider has mounted yet.
let currentInputMethod: InputMethod = 'manual';

export function getCurrentInputMethod(): InputMethod {
  return currentInputMethod;
}

export function _setCurrentInputMethodForProvider(next: InputMethod): void {
  currentInputMethod = next;
}
