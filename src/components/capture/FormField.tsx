import type { Metric } from '@shared/types';

interface FormFieldProps {
  metric: Metric;
  value: string;
  onChange: (value: string) => void;
}

export function FormField({ metric, value, onChange }: FormFieldProps) {
  return (
    <div className="p-4 bg-surface shadow-card border border-border rounded-lg glow-hover">
      <label className="block text-sm font-semibold text-content mb-2">
        {metric.name}
        {metric.question && <span className="font-normal text-content-secondary ml-2">- {metric.question}</span>}
      </label>

      {metric.input_type === 'binary' ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChange('yes')}
            className={`flex-1 py-3 rounded-md text-sm font-medium transition-all min-h-[44px] ${
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
            className={`flex-1 py-3 rounded-md text-sm font-medium transition-all min-h-[44px] ${
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
          className="w-full px-4 py-3 border border-border rounded-md focus:ring-2 focus:ring-primary bg-surface min-h-[44px]"
          placeholder="Enter a number"
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 border border-border rounded-md focus:ring-2 focus:ring-primary bg-surface resize-none min-h-[60px]"
          placeholder="Enter text..."
          rows={2}
        />
      )}
    </div>
  );
}
