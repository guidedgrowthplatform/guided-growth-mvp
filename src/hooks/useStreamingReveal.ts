import { useEffect, useRef, useState } from 'react';

// Reveals `target` progressively at a capped cadence so text flows in like a
// stream instead of dumping whole chunks at once.
//
// Turn boundaries are detected by content, not a key: as long as each new target
// extends what's already shown (a prefix match) the reveal continues — so a slow
// reply whose finals arrive seconds apart keeps flowing in one bubble. When the
// target diverges (a new turn's text), the reveal resets and starts over.
const MAX_CHARS_PER_FRAME = 6; // ~360 chars/s at 60fps — visibly streaming, never a dump
const MIN_CHARS_PER_FRAME = 1;

export function useStreamingReveal(target: string): string {
  const [shown, setShown] = useState('');
  const shownRef = useRef('');
  const rafRef = useRef<number | null>(null);

  const commit = (next: string) => {
    shownRef.current = next;
    setShown(next);
  };

  useEffect(() => {
    if (shownRef.current.length > 0 && !target.startsWith(shownRef.current)) {
      // Divergent text → new turn; reveal from the start.
      commit('');
    } else if (target.length < shownRef.current.length) {
      // Shrank to a prefix (partial replaced) → clamp without re-revealing.
      commit(target);
    }

    const tick = () => {
      const cur = shownRef.current.length;
      if (cur >= target.length) {
        rafRef.current = null;
        return;
      }
      const backlog = target.length - cur;
      const step = Math.min(
        MAX_CHARS_PER_FRAME,
        Math.max(MIN_CHARS_PER_FRAME, Math.ceil(backlog / 8)),
      );
      commit(target.slice(0, Math.min(target.length, cur + step)));
      rafRef.current = requestAnimationFrame(tick);
    };

    if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target]);

  return shown;
}
