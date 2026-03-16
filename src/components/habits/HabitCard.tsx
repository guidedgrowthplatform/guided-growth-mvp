import { Card } from '@/components/ui/Card';

interface HabitCardProps {
  icon?: string;
  name: string;
  subtitle?: string;
  streak: number;
  isDone: boolean;
  onToggleDone: () => void;
  onPress?: () => void;
}

export function HabitCard({
  icon = '',
  name,
  subtitle,
  streak,
  isDone,
  onToggleDone,
  onPress,
}: HabitCardProps) {
  return (
    <Card hoverable onClick={onPress} padding="sm" className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-lg">
        {icon || name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-content">{name}</p>
        {subtitle && <p className="truncate text-sm text-content-secondary">{subtitle}</p>}
      </div>
      {streak > 0 && <span className="shrink-0 text-sm font-medium text-streak">🔥 {streak}</span>}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone();
        }}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          isDone
            ? 'border-success bg-success text-white'
            : 'border-border hover:border-content-tertiary'
        }`}
      >
        {isDone && (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
    </Card>
  );
}
