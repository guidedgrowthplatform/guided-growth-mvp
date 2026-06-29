import { Trash2, FileText, Check, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { HabitDayStatus, HabitType } from '@/lib/services/data-service.interface';
import { IconCircleButton } from './IconCircleButton';

interface HabitListItemProps {
  name: string;
  subtitle?: string;
  streak: number;
  isCompleted?: boolean;
  status?: HabitDayStatus | 'none';
  // Accepted for parity with the data-layer callers (home, coach cards); the row
  // styling does not branch on it today.
  habitType?: HabitType;
  hasNote?: boolean;
  onToggleComplete?: () => void;
  onMarkMissed?: () => void;
  // Data-layer callers (home, coach cards) set an explicit status. When provided,
  // the check/X buttons call this; otherwise they fall back to toggle/mark-missed.
  onSetStatus?: (next: HabitDayStatus) => void;
  onAddNote?: () => void;
  onClick?: () => void;
  onDelete?: () => void;
  // The note (reflection) icon shows by default; pass false to render just the
  // X + check (used by the home tour, where there is no note affordance).
  showNote?: boolean;
}

const OPEN_OFFSET = 88;
const SWIPE_THRESHOLD = 70;

export function HabitListItem({
  name,
  subtitle,
  streak,
  isCompleted,
  status,
  hasNote = false,
  onToggleComplete,
  onMarkMissed,
  onSetStatus,
  onAddNote,
  onClick,
  onDelete,
  showNote = true,
}: HabitListItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<'none' | 'horizontal' | 'vertical'>('none');
  const swiped = useRef(false);
  const offset = useRef(0);

  const swipeable = !!onDelete;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!swipeable) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    axis.current = 'none';
    swiped.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeable) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (axis.current === 'none') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }
    if (axis.current !== 'horizontal') return;
    swiped.current = true;
    const base = isOpen ? -OPEN_OFFSET : 0;
    const next = Math.min(0, Math.max(-OPEN_OFFSET, base + dx));
    offset.current = next;
    setDragX(next);
  };

  const handleTouchEnd = () => {
    if (!swipeable) return;
    if (axis.current === 'horizontal') setIsOpen(offset.current <= -SWIPE_THRESHOLD);
    setDragX(null);
    axis.current = 'none';
  };

  const handleRowClick = () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    onClick?.();
  };

  const dragging = dragX !== null;
  const translateX = dragging ? dragX : isOpen ? -OPEN_OFFSET : 0;
  const markStatus: 'done' | 'missed' | 'none' =
    status === 'done' || status === 'missed' ? status : isCompleted ? 'done' : 'none';

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {swipeable && (
        <div className="absolute inset-y-0 right-0 flex w-[88px] items-stretch">
          <button
            type="button"
            aria-label="Delete habit"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onDelete?.();
            }}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-r-2xl bg-danger text-white"
          >
            <Trash2 size={20} />
            <span className="text-xs font-semibold">Delete</span>
          </button>
        </div>
      )}

      <div
        className={`relative flex cursor-pointer items-center gap-3 rounded-2xl border border-border-light bg-surface p-4 shadow-sm ${
          dragging ? '' : 'transition-transform duration-200 ease-out'
        }`}
        style={{
          transform: `translateX(${translateX}px)`,
          touchAction: swipeable ? 'pan-y' : undefined,
        }}
        onClick={handleRowClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-base font-bold text-content ${isCompleted ? 'line-through' : ''}`}
          >
            {name}
          </p>
          {subtitle && <p className="text-xs font-normal text-content-tertiary">{subtitle}</p>}
        </div>

        {streak > 0 && (
          <div className="flex shrink-0 items-center">
            <span className="text-lg">🔥</span>
            <span className="ml-0.5 text-sm font-bold text-danger">{streak}</span>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {showNote && (
            <IconCircleButton
              icon={FileText}
              active={hasNote}
              onClick={(e) => {
                e.stopPropagation();
                onAddNote?.();
              }}
            />
          )}
          <button
            type="button"
            aria-label="Mark missed"
            aria-pressed={markStatus === 'missed'}
            onClick={(e) => {
              e.stopPropagation();
              if (onSetStatus) onSetStatus(markStatus === 'missed' ? 'pending' : 'missed');
              else onMarkMissed?.();
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-md border-2 transition-colors ${
              markStatus === 'missed'
                ? 'border-danger bg-surface text-danger'
                : 'border-transparent bg-content-tertiary/20 text-content-tertiary'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Mark done"
            aria-pressed={markStatus === 'done'}
            onClick={(e) => {
              e.stopPropagation();
              if (onSetStatus) onSetStatus(markStatus === 'done' ? 'pending' : 'done');
              else onToggleComplete?.();
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-md border-2 transition-colors ${
              markStatus === 'done'
                ? 'border-success bg-success text-white'
                : 'border-transparent bg-content-tertiary/20 text-content-tertiary'
            }`}
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
