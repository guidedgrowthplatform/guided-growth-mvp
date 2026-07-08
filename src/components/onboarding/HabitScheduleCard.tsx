import { Ban, Pencil, Plus, Trash2 } from 'lucide-react';
import { DayPicker } from '@/components/ui/DayPicker';

// UI-side polarity vocabulary, kept separate from the data-layer habit_type on
// purpose. The wiring session maps at the seam:
//   'build' <-> habit_type 'binary_build' (do more of it; legacy 'binary_do')
//   'break' <-> habit_type 'binary_break' (stay away from it; legacy 'binary_avoid')
// Because this component speaks build/break and never imports the data enum,
// the data rename does not have to touch this file.
type HabitPolarity = 'build' | 'break';

interface HabitScheduleCardProps {
  habitName: string;
  polarity: HabitPolarity;
  selectedDays: Set<number>;
  onChangePolarity: (polarity: HabitPolarity) => void;
  onToggleDay: (day: number) => void;
  onEdit: () => void;
  onDelete?: () => void;
}

// Compact onboarding / voice card. The top row keeps the habit name on the left
// and, on the right, a single tap-to-flip Build/Break chip plus icon-only Edit
// (blue pencil) and Delete (red trash). Dropping the control labels frees the
// title to one line; only a long name wraps. The chip stays blue and gray, never
// red/green, so it never reads as a daily result. There is no completion check
// here. Day pills default to off; the AI or a tap turns them on. Edit covers the
// name text and the schedule. Delete fires onDelete (the beat/app confirms).
export function HabitScheduleCard({
  habitName,
  polarity,
  selectedDays,
  onChangePolarity,
  onToggleDay,
  onEdit,
  onDelete,
}: HabitScheduleCardProps) {
  const isBuild = polarity === 'build';
  return (
    <div className="w-full overflow-clip rounded-[20px] border-2 border-primary bg-surface p-[2px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)]">
      <div className="px-[16px] pb-[11px] pt-[13px]">
        <div className="flex items-start justify-between gap-[8px]">
          <span className="min-w-0 flex-1 pt-[4px] text-[16px] font-bold leading-[22px] text-content">
            {habitName}
          </span>
          <div className="flex shrink-0 items-center gap-[4px]">
            <button
              type="button"
              onClick={() => onChangePolarity(isBuild ? 'break' : 'build')}
              aria-label={`Habit type ${isBuild ? 'Build' : 'Break'}, tap to switch`}
              className="flex items-center gap-[3px] rounded-full border border-primary/30 bg-primary/10 px-[8px] py-[3px] text-[11px] font-semibold text-primary"
            >
              {isBuild ? <Plus className="size-[12px]" /> : <Ban className="size-[12px]" />}
              {isBuild ? 'Build' : 'Break'}
            </button>
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit habit"
              className="flex size-[26px] shrink-0 cursor-pointer items-center justify-center rounded-lg text-primary"
            >
              <Pencil className="size-[17px]" />
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete habit"
                className="flex size-[26px] shrink-0 cursor-pointer items-center justify-center rounded-lg text-danger"
              >
                <Trash2 className="size-[17px]" />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="h-px w-full bg-border-light" />
      <div className="bg-surface-secondary/50 px-[16px] py-[11px]">
        <DayPicker selectedDays={selectedDays} onToggleDay={onToggleDay} />
      </div>
    </div>
  );
}
