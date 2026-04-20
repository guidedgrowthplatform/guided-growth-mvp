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
