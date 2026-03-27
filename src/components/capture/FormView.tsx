import { isMetricDue } from '@/utils/metrics';
import type { Metric, DayEntries } from '@shared/types';
import { FormField } from './FormField';

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
      <div className="rounded-2xl border border-border bg-surface p-8 text-center text-content-secondary shadow-card">
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
