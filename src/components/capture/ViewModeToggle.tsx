import type { ViewMode } from '@shared/types';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ viewMode, onChange }: ViewModeToggleProps) {
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-border">
      <button
        onClick={() => onChange('form')}
        className={`px-4 py-2 text-sm font-medium transition-all ${
          viewMode === 'form'
            ? 'bg-primary/20 text-primary'
            : 'bg-surface text-content-secondary hover:bg-surface-secondary'
        }`}
      >
        Form
      </button>
      <button
        onClick={() => onChange('spreadsheet')}
        className={`px-4 py-2 text-sm font-medium transition-all ${
          viewMode === 'spreadsheet'
            ? 'bg-primary/20 text-primary'
            : 'bg-surface text-content-secondary hover:bg-surface-secondary'
        }`}
      >
        Spreadsheet
      </button>
    </div>
  );
}
