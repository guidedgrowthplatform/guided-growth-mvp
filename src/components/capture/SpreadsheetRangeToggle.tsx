import type { SpreadsheetRange } from '@shared/types';

interface SpreadsheetRangeToggleProps {
  range: SpreadsheetRange;
  onChange: (range: SpreadsheetRange) => void;
}

export function SpreadsheetRangeToggle({ range, onChange }: SpreadsheetRangeToggleProps) {
  return (
    <div className="inline-flex rounded-xl border border-cyan-300/50 overflow-hidden">
      <button
        onClick={() => onChange('week')}
        className={`px-3 py-1.5 text-xs font-medium transition-all ${
          range === 'week'
            ? 'bg-gradient-to-r from-cyan-400/30 to-blue-400/30 text-cyan-700'
            : 'bg-white/50 text-slate-600 hover:bg-cyan-50/50'
        }`}
      >
        Week
      </button>
      <button
        onClick={() => onChange('month')}
        className={`px-3 py-1.5 text-xs font-medium transition-all ${
          range === 'month'
            ? 'bg-gradient-to-r from-cyan-400/30 to-blue-400/30 text-cyan-700'
            : 'bg-white/50 text-slate-600 hover:bg-cyan-50/50'
        }`}
      >
        Month
      </button>
    </div>
  );
}
