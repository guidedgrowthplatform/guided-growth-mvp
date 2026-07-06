/**
 * NarrationRevealContext — how a beat card learns which of its elements have
 * bloomed (Lane A A1). The narration driver provides the current reveal count
 * (the highest reveal n reached, REVEAL_ALL = everything); adapters that
 * support per-element blooms consume it via useNarrationElementCount.
 *
 * Backward compatible by default: outside a narration-driven beat the context
 * is null and consumers show every element, exactly as before. Adapters that
 * never consume the context are untouched either way.
 *
 * NO EM DASHES.
 */
import { createContext, useContext } from 'react';

/** null = not narration-driven (show everything); a number = highest reveal n. */
export const NarrationRevealContext = createContext<number | null>(null);

/** Raw reveal count: null outside narration-driven beats. */
export function useNarrationReveal(): number | null {
  return useContext(NarrationRevealContext);
}

/**
 * How many of `total` sequential elements a card should render right now.
 * Outside narration (null) or at REVEAL_ALL (99), all of them.
 */
export function useNarrationElementCount(total: number): number {
  const revealN = useNarrationReveal();
  if (revealN === null) return total;
  return Math.min(total, revealN);
}
