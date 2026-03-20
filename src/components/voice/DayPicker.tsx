const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface DayPickerProps {
  days: boolean[];
  onChange: (days: boolean[]) => void;
}

export function DayPicker({ days, onChange }: DayPickerProps) {
  const toggle = (index: number) => {
    const next = [...days];
    next[index] = !next[index];
    onChange(next);
  };

  return (
    <div className="flex gap-1.5">
      {DAY_LABELS.map((label, i) => (
        <button
          key={i}
          type="button"
          onClick={() => toggle(i)}
          className={`flex aspect-square w-8 items-center justify-center rounded-full text-[12px] font-semibold transition-colors ${
            days[i] ? 'bg-primary text-white' : 'border border-primary bg-white text-primary'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
