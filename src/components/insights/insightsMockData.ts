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

export const completionByRange: Record<string, CompletionStats> = {
  week: {
    percentage: 85,
    trend: '+12%',
    trendPositive: true,
    subtitle: 'Average Completion',
    bars: [
      { label: 'MON', value: 80 },
      { label: 'TUE', value: 110 },
      { label: 'WED', value: 145 },
      { label: 'THU', value: 145 },
      { label: 'FRI', value: 110 },
      { label: 'SAT', value: 145 },
      { label: 'SUN', value: 160 },
    ],
  },
  month: {
    percentage: 78,
    trend: '+8%',
    trendPositive: true,
    subtitle: 'Monthly Average',
    bars: [
      { label: 'W1', value: 120 },
      { label: 'W2', value: 140 },
      { label: 'W3', value: 100 },
      { label: 'W4', value: 155 },
    ],
  },
  year: {
    percentage: 72,
    trend: '-3%',
    trendPositive: false,
    subtitle: 'Yearly Average',
    bars: [
      { label: 'JAN', value: 90 },
      { label: 'FEB', value: 100 },
      { label: 'MAR', value: 130 },
      { label: 'APR', value: 110 },
      { label: 'MAY', value: 125 },
      { label: 'JUN', value: 140 },
      { label: 'JUL', value: 95 },
      { label: 'AUG', value: 115 },
      { label: 'SEP', value: 135 },
      { label: 'OCT', value: 150 },
      { label: 'NOV', value: 120 },
      { label: 'DEC', value: 145 },
    ],
  },
};

export interface HabitPerformance {
  name: string;
  percentage: number;
  streak: string;
  weeklyData: number[];
  bestDay: string;
  totalCompletions: number;
}

export const habitPerformanceData: HabitPerformance[] = [
  {
    name: 'Morning Mindfulness',
    percentage: 80,
    streak: '12 day streak',
    weeklyData: [90, 85, 70, 95, 80, 75, 88],
    bestDay: 'Thursday',
    totalCompletions: 48,
  },
  {
    name: 'Daily Hydration',
    percentage: 65,
    streak: '5 day streak',
    weeklyData: [60, 70, 55, 80, 65, 50, 72],
    bestDay: 'Thursday',
    totalCompletions: 32,
  },
];

export const checkInHistoryData = [
  {
    month: 'MAR',
    day: 19,
    dayName: 'Wednesday',
    daysAgo: 'Today',
    entries: [
      {
        title: 'Morning Check-in',
        time: '8:30 AM',
        iconBg: 'bg-[#fefce8]',
        variant: 'detailed' as const,
        metrics: [
          { icon: 'mdi:weather-sunny', label: 'Mood: Great' },
          { icon: 'mdi:lightning-bolt', label: 'Energy: High' },
          { icon: 'mdi:bed', label: 'Sleep: 7.5 hrs' },
          { icon: 'mdi:head-dots-horizontal', label: 'Stress: Low' },
        ],
        notes:
          "Woke up feeling refreshed after a good night's sleep. Ready to tackle the day with a positive mindset.",
      },
    ],
  },
  {
    month: 'MAR',
    day: 18,
    dayName: 'Tuesday',
    daysAgo: '1 day ago',
    entries: [
      {
        title: 'Morning Check-in',
        time: '9:15 AM',
        iconBg: 'bg-[#fefce8]',
        variant: 'detailed' as const,
        metrics: [
          { icon: 'mdi:weather-sunny', label: 'Mood: Good' },
          { icon: 'mdi:lightning-bolt', label: 'Energy: Medium' },
          { icon: 'mdi:bed', label: 'Sleep: 6 hrs' },
          { icon: 'mdi:head-dots-horizontal', label: 'Stress: Medium' },
        ],
        notes: 'Feeling a bit tired but motivated. Need to focus on hydration today.',
      },
      {
        title: 'Check-in',
        time: '6:00 PM',
        iconBg: 'bg-[#eef2ff]',
        variant: 'compact' as const,
        metrics: [
          { icon: 'mdi:water', label: 'Water: 8 glasses' },
          { icon: 'mdi:run', label: 'Exercise: 30 min' },
          { icon: 'mdi:food-apple', label: 'Nutrition: Good' },
        ],
        notes: null,
      },
    ],
  },
  {
    month: 'MAR',
    day: 17,
    dayName: 'Monday',
    daysAgo: '2 days ago',
    entries: [
      {
        title: 'Morning Check-in',
        time: '7:45 AM',
        iconBg: 'bg-[#fefce8]',
        variant: 'detailed' as const,
        metrics: [
          { icon: 'mdi:weather-sunny', label: 'Mood: Great' },
          { icon: 'mdi:lightning-bolt', label: 'Energy: High' },
          { icon: 'mdi:bed', label: 'Sleep: 8 hrs' },
          { icon: 'mdi:head-dots-horizontal', label: 'Stress: Low' },
        ],
        notes: 'Great start to the week! Meditation session was particularly calming.',
      },
    ],
  },
];

export const availableMonths = [
  'March 2026',
  'February 2026',
  'January 2026',
  'December 2025',
  'November 2025',
];
