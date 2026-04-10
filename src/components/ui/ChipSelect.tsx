interface ChipSelectProps {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
  columns?: number;
}

export function ChipSelect({ options, value, onChange, columns = 3 }: ChipSelectProps) {
  // Group options into rows
  const rows: string[][] = [];
  for (let i = 0; i < options.length; i += columns) {
    rows.push(options.slice(i, i + columns));
  }

  return (
    <div className="flex flex-col gap-[12px]">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-[12px]">
          {row.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`flex-1 whitespace-nowrap rounded-full px-[12px] py-[10px] text-center text-[14px] font-bold leading-[20px] transition-colors ${
                value === option ? 'bg-primary text-white' : 'bg-surface-secondary text-content-subtle'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
