export function weeklySummaryCopy(week: number, month: number): string {
  if (week === 0) return 'No habit completions logged yet this week. A small start counts.';
  const delta = week - month;
  const base = `You've averaged ${week}% habit completion this week.`;
  if (delta > 0) return `${base} That's up ${delta}% from your monthly average.`;
  if (delta < 0)
    return `${base} That's ${Math.abs(delta)}% below your monthly average — let's rebuild momentum.`;
  return `${base} Right on your monthly average.`;
}
