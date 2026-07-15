// Rest-aware habit streak (Rule 7: a rest day BRIDGES the run — it does not break
// the streak and does not count as a win, so the number stays done-days only).
// Pure and string-based so it matches the server's streakEndingAt and is testable
// with an injected `today`.

export function prevDayStr(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() - 1);
  return base.toISOString().slice(0, 10);
}

export function calcHabitStreaks(
  doneDates: Iterable<string>,
  restDates: Iterable<string>,
  today: string,
): { current: number; longest: number } {
  const done = new Set(doneDates);
  const rest = new Set(restDates);
  if (done.size === 0) return { current: 0, longest: 0 };

  // Consecutive done days ending EXACTLY at `day`, walking backward; a rest bridges
  // (skipped, not counted), anything else (missed/pending) stops the run.
  const runEndingAt = (day: string): number => {
    let n = 0;
    let cursor = day;
    while (true) {
      if (done.has(cursor)) n++;
      else if (!rest.has(cursor)) break;
      cursor = prevDayStr(cursor);
    }
    return n;
  };

  let longest = 0;
  for (const d of done) {
    const r = runEndingAt(d);
    if (r > longest) longest = r;
  }

  const yesterday = prevDayStr(today);
  const active = (day: string): boolean => done.has(day) || rest.has(day);
  let current = 0;
  if (active(today)) current = runEndingAt(today);
  else if (active(yesterday)) current = runEndingAt(yesterday);

  return { current, longest };
}
