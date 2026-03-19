import { Icon } from '@iconify/react';
import { DayPicker } from '@/components/ui/DayPicker';

interface HabitSummaryCardProps {
  habitName: string;
  selectedDays: Set<number>;
  onEdit: () => void;
  showCheckmark?: boolean;
  showAiIcon?: boolean;
}

export function HabitSummaryCard({
  habitName,
  selectedDays,
  onEdit,
  showCheckmark,
  showAiIcon,
}: HabitSummaryCardProps) {
  return (
    <div className="w-full overflow-clip rounded-[24px] border-2 border-primary bg-white p-[2px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between p-[20px]">
        <span className="text-[16px] font-bold leading-[24px] text-content">{habitName}</span>
        {(showCheckmark || showAiIcon) && (
          <div className="flex items-center gap-[6px]">
            {showCheckmark && (
              <Icon icon="ic:round-check-circle" className="size-[28px] text-primary" />
            )}
            {showAiIcon && (
              <Icon icon="ic:round-auto-awesome" className="size-[24px] text-[#f59e0b]" />
            )}
          </div>
        )}
      </div>
      <div className="h-px w-full bg-border-light" />
      <div className="flex flex-col gap-[8px] bg-[rgba(248,250,252,0.5)] px-[20px] py-[16px]">
        <div className="flex w-full items-center justify-between">
          <span className="text-[14px] font-semibold leading-[20px] text-content-secondary">
            Schedule:
          </span>
          <button
            type="button"
            onClick={onEdit}
            className="flex cursor-pointer items-center gap-[4px] text-[14px] font-semibold leading-[20px] text-primary"
          >
            Edit
            {showAiIcon && <Icon icon="ic:round-edit" className="size-[16px]" />}
          </button>
        </div>
        <DayPicker selectedDays={selectedDays} onToggleDay={() => {}} disabled />
      </div>
    </div>
  );
}
