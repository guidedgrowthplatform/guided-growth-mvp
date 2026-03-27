import type { Metric } from '@shared/types';

interface FormFieldProps {
  metric: Metric;
  value: string;
  onChange: (value: string) => void;
}

export function FormField({ metric, value, onChange }: FormFieldProps) {
  return (
    <div className="glow-hover rounded-lg border border-border bg-surface p-4 shadow-card">
      <label className="mb-2 block text-sm font-semibold text-content">
        {metric.name}
        {metric.question && (
          <span className="ml-2 font-normal text-content-secondary">- {metric.question}</span>
        )}
      </label>

      {metric.input_type === 'binary' ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChange('yes')}
            className={`min-h-[44px] flex-1 rounded-md py-3 text-sm font-medium transition-all ${
              value === 'yes'
                ? 'bg-success text-white shadow-lg'
                : 'bg-surface-secondary text-content-secondary hover:bg-success/10'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange('no')}
            className={`min-h-[44px] flex-1 rounded-md py-3 text-sm font-medium transition-all ${
              value === 'no'
                ? 'bg-danger text-white shadow-lg'
                : 'bg-surface-secondary text-content-secondary hover:bg-danger/10'
            }`}
          >
            No
          </button>
        </div>
      ) : metric.input_type === 'numeric' ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[44px] w-full rounded-md border border-border bg-surface px-4 py-3 focus:ring-2 focus:ring-primary"
          placeholder="Enter a number"
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[60px] w-full resize-none rounded-md border border-border bg-surface px-4 py-3 focus:ring-2 focus:ring-primary"
          placeholder="Enter text..."
          rows={2}
        />
      )}
    </div>
  );
}
