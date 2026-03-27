export interface DayMetrics {
  mood?: number;
  sleep?: number;
  energy?: number;
  stress?: number;
}

export const mockCalendarData: Record<string, DayMetrics> = {
  '2026-03-01': { mood: 4, sleep: 3, energy: 4, stress: 2 },
  '2026-03-03': { mood: 5, sleep: 5, energy: 5, stress: 1 },
  '2026-03-05': { mood: 3, sleep: 4, energy: 3, stress: 3 },
  '2026-03-07': { mood: 2, sleep: 2, energy: 2, stress: 4 },
  '2026-03-09': { mood: 4, sleep: 4, energy: 4, stress: 2 },
  '2026-03-11': { mood: 5, sleep: 3, energy: 5, stress: 1 },
  '2026-03-13': { mood: 1, sleep: 1, energy: 1, stress: 5 },
  '2026-03-15': { mood: 3, sleep: 4, energy: 3, stress: 3 },
  '2026-03-17': { mood: 4, sleep: 5, energy: 4, stress: 2 },
  '2026-03-19': { mood: 5, sleep: 4, energy: 5, stress: 1 },
  '2026-03-20': { mood: 4, sleep: 3, energy: 4, stress: 2 },
};
