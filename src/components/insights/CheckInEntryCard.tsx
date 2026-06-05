import { Icon } from '@iconify/react';
import { useState } from 'react';

interface Metric {
  icon: string;
  label: string;
}

interface CheckInEntryCardProps {
  title: string;
  time: string;
  iconBg: string;
  metrics: Metric[];
  notes?: string | null;
  variant: 'detailed' | 'compact';
}

export function CheckInEntryCard({
  title,
  time,
  iconBg,
  metrics,
  notes,
  variant,
}: CheckInEntryCardProps) {
  const [notesExpanded, setNotesExpanded] = useState(true);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border-light bg-surface p-[21px] shadow-[0px_4px_20px_-2px_rgba(0,0,0,0.05)]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`rounded-sm p-2 ${iconBg}`}>
          <Icon icon="mdi:white-balance-sunny" width={24} height={24} />
        </div>
        <div>
          <div className="text-[16px] font-bold leading-6 text-content">{title}</div>
          <div className="text-[12px] font-medium uppercase leading-4 tracking-[0.6px] text-content-tertiary">
            {time}
          </div>
        </div>
      </div>

      {/* Metrics */}
      {variant === 'detailed' ? (
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="flex flex-1 items-center gap-1 rounded-md border border-primary bg-primary/5 p-[7px]"
            >
              <Icon icon={m.icon} width={16} height={16} />
              <span className="text-[10px] font-bold leading-3 text-content">{m.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="flex items-center gap-1 rounded-md border border-content-tertiary bg-border-light px-[7px] py-[3px]"
            >
              <Icon icon={m.icon} width={16} height={16} />
              <span className="text-[10px] font-bold leading-3 text-content-tertiary">
                {m.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {notes && (
        <div>
          <button
            aria-expanded={notesExpanded}
            onClick={() => setNotesExpanded(!notesExpanded)}
            className="mb-2 flex items-center gap-1 text-[12px] font-medium text-primary"
          >
            <Icon
              icon="mdi:chevron-down"
              width={14}
              height={14}
              className={`transition-transform duration-200 ${notesExpanded ? '' : '-rotate-90'}`}
            />
            Notes
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              notesExpanded ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="rounded-md border border-primary/10 bg-primary/5 px-[17px] py-4">
              <p className="text-[14px] font-medium leading-[22px] tracking-[0.21px] text-content-subtle">
                {notes}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
