import { Icon } from '@iconify/react';
import { Toggle } from '@/components/ui/Toggle';
import type { Metric } from '@shared/types';

interface HabitManageCardProps {
  metric: Metric;
  onToggleActive: (id: string) => void;
  onMore: (id: string) => void;
  onClick: (id: string) => void;
}

const emojiColors: Record<string, string> = {
  M: 'bg-blue-100 dark:bg-blue-900/40',
  D: 'bg-amber-100 dark:bg-amber-900/40',
  R: 'bg-emerald-100 dark:bg-emerald-900/40',
  A: 'bg-purple-100 dark:bg-purple-900/40',
  W: 'bg-rose-100 dark:bg-rose-900/40',
  S: 'bg-cyan-100 dark:bg-cyan-900/40',
};

function getEmojiAndColor(name: string) {
  const firstChar = name.charAt(0).toUpperCase();
  const bg = emojiColors[firstChar] || 'bg-slate-100 dark:bg-slate-800';
  return { letter: firstChar, bg };
}

const frequencyLabels: Record<string, string> = {
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekends: 'Weekends',
  weekly: 'Once a week',
  '3_specific_days': '3 days / week',
  '5_specific_days': '5 days / week',
};

function formatFrequency(freq: string): string {
  if (frequencyLabels[freq]) return frequencyLabels[freq];
  const match = freq.match(/^(\d+)_specific_days$/);
  if (match) return `${match[1]} days / week`;
  return freq.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function formatSubtitle(metric: Metric): string {
  const parts: string[] = [];
  if (metric.target_value != null && metric.target_unit) {
    parts.push(`${metric.target_value} ${metric.target_unit}`);
  }
  if (metric.frequency) {
    parts.push(formatFrequency(metric.frequency));
  }
  return parts.join(' · ') || 'Every day';
}

export function HabitManageCard({ metric, onToggleActive, onMore, onClick }: HabitManageCardProps) {
  const isActive = metric.active;
  const { letter, bg } = getEmojiAndColor(metric.name);

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl p-4 transition-all duration-300 ${
        isActive
          ? 'bg-surface shadow-card'
          : 'border border-border-light bg-surface-secondary opacity-70'
      }`}
      onClick={() => onClick(metric.id)}
      role="button"
      tabIndex={0}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-content ${
          isActive ? bg : 'bg-slate-100 dark:bg-slate-800'
        }`}
      >
        {letter}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-base font-bold ${
            isActive ? 'text-content' : 'text-content-muted'
          }`}
        >
          {metric.name}
        </p>
        <p className="text-xs font-medium text-content-secondary">{formatSubtitle(metric)}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div onClick={(e) => e.stopPropagation()}>
          <Toggle checked={isActive} onChange={() => onToggleActive(metric.id)} />
        </div>
        <button
          className="rounded-full p-1 text-content-secondary hover:bg-surface-secondary"
          onClick={(e) => {
            e.stopPropagation();
            onMore(metric.id);
          }}
        >
          <Icon icon="mdi:dots-vertical" className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
