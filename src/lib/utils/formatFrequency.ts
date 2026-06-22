const LABELS: Record<string, string> = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekends: 'Weekends',
  weekly: 'Weekly',
  once_a_week: 'Weekly',
  once_in_week: 'Weekly',
  '3_specific_days': '3x / week',
};

export function formatFrequency(frequency: string): string {
  if (!frequency) return '';
  if (LABELS[frequency]) return LABELS[frequency];

  const perWeek = frequency.match(/^(\d+)\s*x\s*\/?\s*week$/i);
  if (perWeek) return `${perWeek[1]}x / week`;

  return frequency.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
