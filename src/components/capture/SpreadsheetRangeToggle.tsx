import type { SpreadsheetRange } from '@shared/types';

interface SpreadsheetRangeToggleProps {
  range: SpreadsheetRange;
  onChange: (range: SpreadsheetRange) => void;
}

export function SpreadsheetRangeToggle({ range, onChange }: SpreadsheetRangeToggleProps) {
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-border">
      <button
        onClick={() => onChange('week')}
        className={`px-3 py-1.5 text-xs font-medium transition-all ${
          range === 'week'
            ? 'bg-primary/20 text-primary'
            : 'bg-surface text-content-secondary hover:bg-surface-secondary'
        }`}
      >
        Week
      </button>
      <button
        onClick={() => onChange('month')}
        className={`px-3 py-1.5 text-xs font-medium transition-all ${
          range === 'month'
            ? 'bg-primary/20 text-primary'
            : 'bg-surface text-content-secondary hover:bg-surface-secondary'
        }`}
      >
        Month
      </button>
    </div>
  );
}
