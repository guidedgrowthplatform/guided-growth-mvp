import type { Metric } from '@shared/types';

interface FormFieldProps {
  metric: Metric;
  value: string;
  onChange: (value: string) => void;
}

export function FormField({ metric, value, onChange }: FormFieldProps) {
  return (
    <div className="p-4 glass rounded-xl border border-cyan-200/30 glow-hover">
      <label className="block text-sm font-semibold text-slate-800 mb-2">
        {metric.name}
        {metric.question && <span className="font-normal text-slate-500 ml-2">- {metric.question}</span>}
      </label>

      {metric.input_type === 'binary' ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChange('yes')}
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
              value === 'yes'
                ? 'bg-emerald-500 text-white shadow-lg'
                : 'bg-slate-100/50 text-slate-600 hover:bg-emerald-100/50'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange('no')}
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
              value === 'no'
                ? 'bg-red-500 text-white shadow-lg'
                : 'bg-slate-100/50 text-slate-600 hover:bg-red-100/50'
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
          className="w-full px-4 py-3 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 bg-white/80 min-h-[44px]"
          placeholder="Enter a number"
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 bg-white/80 resize-none min-h-[60px]"
          placeholder="Enter text..."
          rows={2}
        />
      )}
    </div>
  );
}
