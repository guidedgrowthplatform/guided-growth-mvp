// Shared types for habit analytics — used by useHabitAnalytics hook and insight components

export interface BarDataPoint {
  label: string;
  value: number;
}

export interface CompletionStats {
  percentage: number;
  trend: string;
  trendPositive: boolean;
  subtitle: string;
  bars: BarDataPoint[];
}

export interface HabitPerformance {
  name: string;
  percentage: number;
  streak: string;
  weeklyData: number[];
  bestDay: string;
  totalCompletions: number;
}
