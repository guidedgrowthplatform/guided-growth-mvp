import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSwipeLeft } from '@/hooks/useSwipeLeft';

const BAR_HEIGHT = 88;
const BAR_BOTTOM = 240;

interface SubtitleBarProps {
  text: string;
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
}

export function SubtitleBar({ text, collapsed, onCollapse, onExpand }: SubtitleBarProps) {
  const swipe = useSwipeLeft(onCollapse);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onExpand}
        aria-label="Show coach subtitle"
        style={{ bottom: BAR_BOTTOM, height: BAR_HEIGHT }}
        className="fixed left-0 z-30 flex w-7 items-center justify-center rounded-r-2xl bg-surface-secondary text-content shadow-[0_8px_24px_-8px_rgba(15,23,42,0.4)]"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ bottom: BAR_BOTTOM, height: BAR_HEIGHT }}
      className="fixed inset-x-4 z-30 flex items-center gap-2 rounded-2xl bg-surface-secondary px-3 pr-8 text-content shadow-[0_8px_24px_-8px_rgba(15,23,42,0.4)]"
      {...swipe}
    >
      <button
        type="button"
        onClick={onCollapse}
        aria-label="Minimize subtitle"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="line-clamp-2 flex-1 text-[15px] font-semibold leading-[20px]">{text}</p>
      <button
        type="button"
        onClick={onCollapse}
        aria-label="Minimize subtitle"
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
