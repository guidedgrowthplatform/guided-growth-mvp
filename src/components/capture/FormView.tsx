import type { Metric, DayEntries } from '@shared/types';
import { FormField } from './FormField';
import { isMetricDue } from '@/utils/metrics';

interface FormViewProps {
  date: string;
  metrics: Metric[];
  entries: DayEntries;
  onChange: (metricId: string, value: string) => void;
}

export function FormView({ date, metrics, entries, onChange }: FormViewProps) {
  const dueMetrics = metrics.filter((m) => isMetricDue(m, date));

  if (dueMetrics.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-slate-500 border border-cyan-200/50">
        No metrics due for this day.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {dueMetrics.map((metric) => (
        <FormField
          key={metric.id}
          metric={metric}
          value={entries[metric.id] || ''}
          onChange={(value) => onChange(metric.id, value)}
        />
      ))}
    </div>
  );
}
