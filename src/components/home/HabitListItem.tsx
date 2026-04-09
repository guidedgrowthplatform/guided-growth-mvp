import { FileText, Plus, Check } from 'lucide-react';
import { IconCircleButton } from './IconCircleButton';

interface HabitListItemProps {
  name: string;
  subtitle?: string;
  streak: number;
  isCompleted: boolean;
  hasNote?: boolean;
  onToggleComplete: () => void;
  onAddNote?: () => void;
  onClick?: () => void;
}

export function HabitListItem({
  name,
  subtitle,
  streak,
  isCompleted,
  hasNote = false,
  onToggleComplete,
  onAddNote,
  onClick,
}: HabitListItemProps) {
  return (
    <div
      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border-light bg-surface p-4 shadow-sm"
      onClick={onClick}
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
        {/* Note icon — only green when user has actually written a note */}
        <IconCircleButton
          icon={FileText}
          active={hasNote}
          onClick={(e) => {
            e.stopPropagation();
            onAddNote?.();
          }}
        />
        {/* Complete button */}
        <IconCircleButton
          icon={isCompleted ? Check : Plus}
          active={isCompleted}
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete();
          }}
        />
      </div>
    </div>
  );
}
