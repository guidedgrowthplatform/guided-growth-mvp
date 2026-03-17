import { DayPicker } from './DayPicker';

interface HabitSummaryCardProps {
  habitName: string;
  selectedDays: Set<number>;
  onEdit: () => void;
}

export function HabitSummaryCard({ habitName, selectedDays, onEdit }: HabitSummaryCardProps) {
  return (
    <div className="w-full overflow-clip rounded-[24px] border-2 border-[#135bec] bg-white p-[2px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)]">
      <div className="p-[20px]">
        <span className="text-[16px] font-bold leading-[24px] text-[#111318]">{habitName}</span>
      </div>
      <div className="h-px w-full bg-[#f1f5f9]" />
      <div className="flex flex-col gap-[8px] bg-[rgba(248,250,252,0.5)] px-[20px] py-[16px]">
        <div className="flex w-full items-center justify-between">
          <span className="text-[14px] font-semibold leading-[20px] text-[#64748b]">Schedule:</span>
          <button
            type="button"
            onClick={onEdit}
            className="cursor-pointer text-[14px] font-semibold leading-[20px] text-[#64748b]"
          >
            Edit
          </button>
        </div>
        <DayPicker selectedDays={selectedDays} onToggleDay={() => {}} disabled />
      </div>
    </div>
  );
}
