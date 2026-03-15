import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  error?: string;
}

export function Select({ label, options, error, className = '', ...props }: SelectProps) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-content mb-1">{label}</label>}
      <select
        className={`w-full px-3 py-2 text-sm border border-border rounded-md bg-surface outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${error ? 'border-danger' : ''} ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
