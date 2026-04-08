import { type MetricType, metricConfigs, metricTabs } from './calendarConfig';

interface MetricSegmentedControlProps {
  value: MetricType;
  onChange: (metric: MetricType) => void;
}

export function MetricSegmentedControl({ value, onChange }: MetricSegmentedControlProps) {
  return (
    <div className="flex rounded-3xl bg-surface-secondary p-1">
      {metricTabs.map((metric) => (
        <button
          key={metric}
          onClick={() => onChange(metric)}
          className={`flex-1 rounded-2xl px-3 py-2 text-[13px] transition-all ${
            value === metric
              ? 'bg-surface font-bold text-primary shadow-sm'
              : 'font-semibold text-content-tertiary'
          }`}
        >
          {metricConfigs[metric].label}
        </button>
      ))}
    </div>
  );
}
