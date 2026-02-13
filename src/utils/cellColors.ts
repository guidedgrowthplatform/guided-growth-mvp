import type { Metric } from '@shared/types';

export function getCellColor(value: string | undefined | null, metric: Metric): string {
  if (!value || value === '') return 'bg-slate-100/30 text-slate-500';
  if (value === '-') return 'bg-slate-200/50 text-slate-400';

  if (metric.input_type === 'binary') {
    return value === 'yes'
      ? 'bg-emerald-400/80 text-white font-semibold'
      : 'bg-red-400/80 text-white font-semibold';
  }

  // Numeric with value
  if (metric.input_type === 'numeric') {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) return 'bg-emerald-400/80 text-white font-semibold';
    if (!isNaN(num) && num === 0) return 'bg-red-400/80 text-white font-semibold';
  }

  // Text/short_text with value
  if (value.trim() !== '') return 'bg-emerald-200/60 text-slate-800';

  return 'bg-slate-100/30 text-slate-500';
}

export function getCellDisplayValue(value: string | undefined | null, metric: Metric): string {
  if (!value || value === '') return '';
  if (value === '-') return '-';
  if (metric.input_type === 'binary') {
    return value === 'yes' ? '1' : value === 'no' ? '0' : value;
  }
  return value;
}
