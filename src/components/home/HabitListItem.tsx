import { FileText, Plus, Check } from 'lucide-react';
import { IconCircleButton } from './IconCircleButton';

interface HabitListItemProps {
  name: string;
  subtitle?: string;
  streak: number;
  isCompleted: boolean;
  onToggleComplete: () => void;
  onAddNote?: () => void;
}

export function HabitListItem({
  name,
  subtitle,
  streak,
  isCompleted,
  onToggleComplete,
  onAddNote,
}: HabitListItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border-light bg-surface p-4 shadow-sm">
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
        <IconCircleButton icon={FileText} active={isCompleted} onClick={onAddNote} />
        <IconCircleButton
          icon={isCompleted ? Check : Plus}
          active={isCompleted}
          onClick={onToggleComplete}
        />
      </div>
    </div>
  );
}
