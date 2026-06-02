import { useEffect, useRef, useState } from 'react';

export function useSmoothReveal(target: string): string {
  const [shown, setShown] = useState(target);
  const shownLenRef = useRef(target.length);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target.length < shownLenRef.current) {
      shownLenRef.current = target.length;
      setShown(target);
      return;
    }

    const tick = () => {
      const cur = shownLenRef.current;
      if (cur >= target.length) {
        rafRef.current = null;
        return;
      }
      const step = Math.max(1, Math.ceil((target.length - cur) / 8));
      const next = Math.min(target.length, cur + step);
      shownLenRef.current = next;
      setShown(target.slice(0, next));
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
