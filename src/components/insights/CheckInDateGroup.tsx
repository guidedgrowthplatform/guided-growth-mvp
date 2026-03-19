import { CheckInEntryCard } from './CheckInEntryCard';

interface Entry {
  title: string;
  time: string;
  iconBg: string;
  variant: 'detailed' | 'compact';
  metrics: { icon: string; label: string }[];
  notes?: string | null;
}

interface CheckInDateGroupProps {
  month: string;
  day: number;
  dayName: string;
  daysAgo: string;
  entries: Entry[];
}

export function CheckInDateGroup({ month, day, dayName, daysAgo, entries }: CheckInDateGroupProps) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex h-[60px] w-[50px] flex-col items-center justify-center gap-1 overflow-hidden rounded-sm bg-primary py-1">
          <span className="text-[10px] leading-3 text-white">{month}</span>
          <span className="text-[16px] font-semibold text-white">{day}</span>
          <div className="h-1 w-1 rounded-full bg-white/50" />
        </div>
        <div className="flex flex-col">
          <span className="text-[16px] font-bold leading-6 text-primary">{dayName}</span>
          <span className="text-[10px] font-bold leading-3 text-primary">{daysAgo}</span>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {entries.map((entry, i) => (
          <CheckInEntryCard key={i} {...entry} notes={entry.notes ?? undefined} />
        ))}
      </div>
    </div>
  );
}
