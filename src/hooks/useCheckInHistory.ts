import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { queryKeys } from '@/lib/query';
import type { CheckInRecord } from '@/lib/services/data-service.interface';
import { getDataService } from '@/lib/services/service-provider';

export interface CheckInMetric {
  icon: string;
  label: string;
}

export interface CheckInEntry {
  title: string;
  time: string;
  iconBg: string;
  variant: 'detailed' | 'compact';
  metrics: CheckInMetric[];
  notes: string | null;
}

export interface CheckInDateGroup {
  month: string;
  day: number;
  dayName: string;
  daysAgo: string;
  entries: CheckInEntry[];
}

const MONTH_ABBR = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function moodLabel(value: number | null): string {
  if (value === null) return 'N/A';
  const labels: Record<number, string> = { 1: 'Awful', 2: 'Bad', 3: 'Meh', 4: 'Good', 5: 'Great' };
  return labels[value] ?? 'N/A';
}

function energyLabel(value: number | null): string {
  if (value === null) return 'N/A';
  const labels: Record<number, string> = {
    1: 'Drained',
    2: 'Low',
    3: 'Medium',
    4: 'High',
    5: 'Charged',
  };
  return labels[value] ?? 'N/A';
}

function sleepLabel(value: number | null): string {
  if (value === null) return 'N/A';
  const labels: Record<number, string> = {
    1: 'Terrible',
    2: 'Poor',
    3: 'Fair',
    4: 'Good',
    5: 'Excellent',
  };
  return labels[value] ?? 'N/A';
}

function stressLabel(value: number | null): string {
  if (value === null) return 'N/A';
  const labels: Record<number, string> = {
    1: 'Calm',
    2: 'Low',
    3: 'Moderate',
    4: 'High',
    5: 'Extreme',
  };
  return labels[value] ?? 'N/A';
}

function daysAgoText(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = Math.floor((today.getTime() - target.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  return `${diff} days ago`;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function recordToGroup(record: CheckInRecord): CheckInDateGroup {
  const date = new Date(record.date + 'T00:00:00');
  const metrics: CheckInMetric[] = [];

  if (record.mood !== null) {
    metrics.push({ icon: 'mdi:weather-sunny', label: `Mood: ${moodLabel(record.mood)}` });
  }
  if (record.energy !== null) {
    metrics.push({ icon: 'mdi:lightning-bolt', label: `Energy: ${energyLabel(record.energy)}` });
  }
  if (record.sleep !== null) {
    metrics.push({ icon: 'mdi:bed', label: `Sleep: ${sleepLabel(record.sleep)}` });
  }
  if (record.stress !== null) {
    metrics.push({
      icon: 'mdi:head-dots-horizontal',
      label: `Stress: ${stressLabel(record.stress)}`,
    });
  }

  return {
    month: MONTH_ABBR[date.getMonth()],
    day: date.getDate(),
    dayName: DAY_NAMES[date.getDay()],
    daysAgo: daysAgoText(record.date),
    entries: [
      {
        title: 'Daily Check-in',
        time: formatTime(record.createdAt),
        iconBg: 'bg-[#fefce8]',
        variant: 'detailed',
        metrics,
        notes: null,
      },
    ],
  };
}

function buildAvailableMonths(): string[] {
  const months: string[] = [];
  const now = new Date();
  const FULL_MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${FULL_MONTHS[d.getMonth()]} ${d.getFullYear()}`);
  }
  return months;
}

function monthStringToRange(monthStr: string): { start: string; end: string } {
  const parts = monthStr.split(' ');
  const FULL_MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const monthIdx = FULL_MONTHS.indexOf(parts[0]);
  const year = parseInt(parts[1], 10);
  const start = `${year}-${String(monthIdx + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  const end = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export function useCheckInHistory() {
  const availableMonths = useMemo(() => buildAvailableMonths(), []);
  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0]);

  const { start, end } = useMemo(() => monthStringToRange(selectedMonth), [selectedMonth]);

  const {
    data: checkIns = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.checkins.range(start, end),
    queryFn: async () => {
      const svc = await getDataService();
      return svc.getCheckIns(start, end);
    },
  });

  const groups = useMemo(
    () => [...checkIns].sort((a, b) => b.date.localeCompare(a.date)).map(recordToGroup),
    [checkIns],
  );

  return {
    groups,
    availableMonths,
    selectedMonth,
    setSelectedMonth,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
