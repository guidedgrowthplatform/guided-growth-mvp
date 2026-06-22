import { useRef } from 'react';

export function useSwipeLeft(onSwipeLeft: () => void, threshold = 40) {
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length !== 1) {
        tracking.current = false;
        return;
      }
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      tracking.current = true;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!tracking.current) return;
      tracking.current = false;
      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;
      if (dx <= -threshold && Math.abs(dx) > Math.abs(dy)) onSwipeLeft();
    },
  };
}
