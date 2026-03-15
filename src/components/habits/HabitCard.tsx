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

export function HabitCard({ icon = '', name, subtitle, streak, isDone, onToggleDone, onPress }: HabitCardProps) {
  return (
    <Card hoverable onClick={onPress} padding="sm" className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-lg shrink-0">
        {icon || name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-content truncate">{name}</p>
        {subtitle && <p className="text-sm text-content-secondary truncate">{subtitle}</p>}
      </div>
      {streak > 0 && (
        <span className="text-sm text-streak font-medium shrink-0">
          🔥 {streak}
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          isDone ? 'bg-success border-success text-white' : 'border-border hover:border-content-tertiary'
        }`}
      >
        {isDone && (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
    </Card>
  );
}
