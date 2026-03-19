import { Clock } from 'lucide-react';

interface DaySchedulePillsProps {
  activeDays: boolean[];
  frequencyLabel: string;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function DaySchedulePills({ activeDays, frequencyLabel }: DaySchedulePillsProps) {
  return (
    <div>
      <div className="mt-1 flex items-center justify-between">
        {DAY_LABELS.map((label, i) => (
          <div
            key={i}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-xs shadow-sm ${
              activeDays[i]
                ? 'bg-primary font-thin text-white'
                : 'border border-[#94a3b8] bg-white font-thin text-[#94a3b8]'
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[rgba(25,120,229,0.05)] bg-[rgba(25,120,229,0.1)] px-[13px] py-[7px]">
        <Clock size={16} className="text-[#1978e5]" />
        <span className="text-sm font-semibold text-[#1978e5]">{frequencyLabel}</span>
      </div>
    </div>
  );
}
