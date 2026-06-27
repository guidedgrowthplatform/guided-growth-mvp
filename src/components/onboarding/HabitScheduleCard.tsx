import { Ban, Pencil, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { DayPicker } from '@/components/ui/DayPicker';

export type HabitType = 'build' | 'break';

interface HabitScheduleCardProps {
  habitName: string;
  habitType: HabitType;
  selectedDays: Set<number>;
  onChangeType: (type: HabitType) => void;
  onToggleDay: (day: number) => void;
  onEdit: () => void;
}

// Compact onboarding / voice card: habit name + Edit on top, a neutral
// Build/Break type toggle, then the round day-schedule pills. There is no
// completion check here. Green check and red X stay reserved for did-it /
// missed-it on the check-in rows, so the Build/Break marker is blue and gray on
// purpose and never reads as a daily result. Day pills default to off; the AI
// or a tap turns them on. Edit covers both the name text and the schedule.
export function HabitScheduleCard({
  habitName,
  habitType,
  selectedDays,
  onChangeType,
  onToggleDay,
  onEdit,
}: HabitScheduleCardProps) {
  return (
    <div className="w-full overflow-clip rounded-[20px] border-2 border-primary bg-surface p-[2px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)]">
      <div className="px-[16px] pb-[11px] pt-[13px]">
        <div className="flex items-center justify-between gap-[10px]">
          <span className="text-[16px] font-bold leading-[22px] text-content">{habitName}</span>
          <button
            type="button"
            onClick={onEdit}
            className="flex shrink-0 cursor-pointer items-center gap-[4px] text-[14px] font-semibold leading-[20px] text-primary"
          >
            Edit
            <Pencil className="size-[15px]" />
          </button>
        </div>
        <div className="mt-[9px] inline-flex gap-[6px]">
          <TypeOption
            active={habitType === 'build'}
            icon={<Plus className="size-[14px]" />}
            label="Build"
            onClick={() => onChangeType('build')}
          />
          <TypeOption
            active={habitType === 'break'}
            icon={<Ban className="size-[14px]" />}
            label="Break"
            onClick={() => onChangeType('break')}
          />
        </div>
      </div>
      <div className="h-px w-full bg-border-light" />
      <div className="bg-surface-secondary/50 px-[16px] py-[11px]">
        <DayPicker selectedDays={selectedDays} onToggleDay={onToggleDay} />
      </div>
    </div>
  );
}

function TypeOption({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-[5px] rounded-full border px-[11px] py-[5px] text-[12px] font-semibold transition-colors ${
        active
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'border-border bg-transparent text-content-tertiary'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
