const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface DayPickerProps {
  selectedDays: Set<number>;
  onToggleDay: (day: number) => void;
  disabled?: boolean;
}

export function DayPicker({ selectedDays, onToggleDay, disabled = false }: DayPickerProps) {
  return (
    <div className="flex justify-between pt-[4px]">
      {DAY_LABELS.map((label, i) => {
        const active = selectedDays.has(i);
        return (
          <button
            key={i}
            type="button"
            onClick={() => !disabled && onToggleDay(i)}
            disabled={disabled}
            className={`flex size-[40px] items-center justify-center rounded-full border text-[12px] font-bold transition-colors ${
              active
                ? 'border-primary bg-primary text-white'
                : 'border-primary bg-white text-primary shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]'
            } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
