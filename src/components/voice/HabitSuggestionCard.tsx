import { DayPicker } from './DayPicker';

interface HabitSuggestionCardProps {
  name: string;
  days: boolean[];
  onDaysChange: (days: boolean[]) => void;
  onEdit?: () => void;
}

export function HabitSuggestionCard({
  name,
  days,
  onDaysChange,
  onEdit,
}: HabitSuggestionCardProps) {
  return (
    <div className="mb-4 ml-0 mr-auto max-w-[290px] animate-bubble-in overflow-hidden rounded-3xl border-2 border-primary bg-white shadow-[0px_8px_30px_rgba(0,0,0,0.04)]">
      <div className="p-5">
        <h4 className="text-[16px] font-bold text-[#111318]">{name}</h4>
      </div>
      <div className="h-px bg-[#f1f5f9]" />
      <div className="bg-[#f8fafc]/50 px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-[#64748b]">Schedule:</span>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="text-[14px] font-semibold text-[#64748b]"
            >
              Edit
            </button>
          )}
        </div>
        <DayPicker days={days} onChange={onDaysChange} />
      </div>
    </div>
  );
}
