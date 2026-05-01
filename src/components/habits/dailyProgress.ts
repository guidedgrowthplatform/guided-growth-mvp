export const MAX_PROGRESS_SEGMENTS = 8;

export function computeProgressSegments(
  completed: number,
  total: number,
): { segmentCount: number; filledSegments: number; percent: number } {
  if (total <= 0) return { segmentCount: 0, filledSegments: 0, percent: 0 };
  const safeCompleted = Math.max(0, Math.min(completed, total));
  const percent = Math.round((safeCompleted / total) * 100);
  const segmentCount = Math.min(total, MAX_PROGRESS_SEGMENTS);
  const filledSegments =
    total <= MAX_PROGRESS_SEGMENTS
      ? safeCompleted
      : Math.round((safeCompleted / total) * MAX_PROGRESS_SEGMENTS);
  return { segmentCount, filledSegments, percent };
}
