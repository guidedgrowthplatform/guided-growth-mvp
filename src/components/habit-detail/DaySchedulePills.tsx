import { Clock } from 'lucide-react';

interface DaySchedulePillsProps {
  activeDays: boolean[];
  frequencyLabel: string;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function DaySchedulePills({ activeDays, frequencyLabel }: DaySchedulePillsProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        {DAY_LABELS.map((label, i) => (
          <div
            key={i}
            className={`flex h-10 w-10 items-center justify-center rounded-md text-xs shadow-sm ${
              activeDays[i]
                ? 'bg-success font-thin text-white'
                : 'border border-border bg-surface-secondary font-thin text-content-tertiary'
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-success/10 bg-success/10 px-[13px] py-[7px]">
        <Clock size={16} className="text-success" />
        <span className="text-sm font-semibold text-success">{frequencyLabel}</span>
      </div>
    </div>
  );
}
