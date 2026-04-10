import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface BottomSheetProps {
  onClose: () => void;
  children: ReactNode | ((close: () => void) => ReactNode);
  topOffset?: string;
  showHandle?: boolean;
  preventClose?: boolean;
}

const DRAG_CLOSE_THRESHOLD = 100;

export function BottomSheet({ onClose, children, topOffset, showHandle = true, preventClose = false }: BottomSheetProps) {
  const [phase, setPhase] = useState<'entering' | 'open' | 'exiting'>('entering');
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef(0);
  const isDragging = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase('open'));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Prevent body scroll while sheet is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = useCallback(() => {
    if (preventClose) return;
    setPhase('exiting');
  }, [preventClose]);

  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent) => {
      if (phase === 'exiting' && e.currentTarget === e.target) {
        onClose();
      }
    },
    [phase, onClose],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = true;
    setDragY(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    setDragY(Math.max(0, delta));
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (dragY > DRAG_CLOSE_THRESHOLD) {
      handleClose();
    }
    setDragY(0);
  }, [dragY, handleClose]);

  const isVisible = phase === 'open';

  const isAutoHeight = !topOffset;

  const sheetPositionClass = isAutoHeight
    ? 'absolute inset-x-0 bottom-0'
    : `absolute inset-x-0 bottom-0 ${topOffset}`;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-all duration-300 ease-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      <div className="pointer-events-none absolute inset-0">
        <div
          ref={sheetRef}
          className={`pointer-events-auto ${sheetPositionClass} flex flex-col overflow-hidden rounded-t-[32px] bg-surface-secondary shadow-[0px_-8px_30px_0px_rgba(0,0,0,0.08)] ${
            dragY > 0 ? '' : 'transition-transform duration-300 ease-out'
          } ${isVisible && dragY === 0 ? 'translate-y-0' : !isVisible ? 'translate-y-full' : ''}`}
          style={
            isAutoHeight
              ? {
                  maxHeight: '80vh',
                  ...(dragY > 0 ? { transform: `translateY(${dragY}px)` } : {}),
                }
              : dragY > 0
                ? { transform: `translateY(${dragY}px)` }
                : undefined
          }
          onTransitionEnd={handleTransitionEnd}
        >
          {showHandle && (
            <div
              className="flex cursor-grab justify-center pb-2 pt-4 active:cursor-grabbing"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="h-1.5 w-12 rounded-full bg-border" />
            </div>
          )}
          <div
            className={`overscroll-contain pb-[env(safe-area-inset-bottom)] ${isAutoHeight ? 'overflow-y-auto' : 'flex-1 overflow-y-auto'}`}
          >
            {typeof children === 'function' ? children(handleClose) : children}
          </div>
        </div>
      </div>
    </div>
  );
}
