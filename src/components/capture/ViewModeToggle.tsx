import type { ViewMode } from '@shared/types';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ viewMode, onChange }: ViewModeToggleProps) {
  return (
    <div className="inline-flex rounded-xl border border-cyan-300/50 overflow-hidden">
      <button
        onClick={() => onChange('form')}
        className={`px-4 py-2 text-sm font-medium transition-all ${
          viewMode === 'form'
            ? 'bg-gradient-to-r from-cyan-400/30 to-blue-400/30 text-cyan-700'
            : 'bg-white/50 text-slate-600 hover:bg-cyan-50/50'
        }`}
      >
        Form
      </button>
      <button
        onClick={() => onChange('spreadsheet')}
        className={`px-4 py-2 text-sm font-medium transition-all ${
          viewMode === 'spreadsheet'
            ? 'bg-gradient-to-r from-cyan-400/30 to-blue-400/30 text-cyan-700'
            : 'bg-white/50 text-slate-600 hover:bg-cyan-50/50'
        }`}
      >
        Spreadsheet
      </button>
    </div>
  );
}
