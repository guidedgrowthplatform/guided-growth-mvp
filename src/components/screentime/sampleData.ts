// Presentation-only sample data for the Screen Time UI.
//
// On iOS the real per-app usage + names live in the native DeviceActivityReport
// (opaque tokens never reach JS), so these rows drive the *visual* flow for
// design review + the web preview until the native report is wired in.

export type UsageRange = 'today' | 'week';

export interface SampleApp {
  id: string;
  name: string;
  icon: string;
  /** Usage this range, pre-formatted (e.g. "2h 14m"). */
  time: string;
  /** Bar fill 0-100 (share of its limit, or of the heaviest app when no limit). */
  fill: number;
  /** Caption under the bar, e.g. "of your 2h limit" / "no limit set". */
  sub: string;
  /** Whether the app is currently shielded ("Resting until tomorrow"). */
  resting: boolean;
  /** Heavy usage (fill accent) vs light (muted bar). */
  heavy: boolean;
  // App-detail values
  todayTime: string;
  dailyAverage: string;
  limitOn: boolean;
  /** Limit in minutes; null when no limit set. */
  limitMinutes: number | null;
}

export interface RangeSummary {
  total: string;
  caption: string;
  /** Bar-chart heights 0-100. */
  bars: number[];
  labels: string[];
}

export const SUMMARY: Record<UsageRange, RangeSummary> = {
  today: {
    total: '4h 26m',
    caption: '32m less than yesterday',
    bars: [18, 10, 8, 14, 30, 44, 38, 26, 20, 34, 52, 60, 48, 72, 100, 88, 64, 40],
    labels: ['6 AM', '12 PM', '6 PM', '11 PM'],
  },
  week: {
    total: '26h 40m',
    caption: '3h 48m daily average',
    bars: [64, 52, 78, 45, 90, 100, 70],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
};

export const SAMPLE_APPS: Record<UsageRange, SampleApp[]> = {
  today: [
    {
      id: 'instagram',
      name: 'Instagram',
      icon: 'mdi:instagram',
      time: '2h 14m',
      fill: 100,
      sub: 'of your 2h limit',
      resting: true,
      heavy: true,
      todayTime: '2h 14m',
      dailyAverage: '1h 40m daily average',
      limitOn: true,
      limitMinutes: 120,
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: 'ic:baseline-tiktok',
      time: '1h 02m',
      fill: 46,
      sub: 'of your 1h 30m limit',
      resting: false,
      heavy: true,
      todayTime: '1h 02m',
      dailyAverage: '52m daily average',
      limitOn: true,
      limitMinutes: 90,
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: 'mdi:youtube',
      time: '48m',
      fill: 36,
      sub: 'no limit set',
      resting: false,
      heavy: false,
      todayTime: '48m',
      dailyAverage: '39m daily average',
      limitOn: false,
      limitMinutes: null,
    },
    {
      id: 'safari',
      name: 'Safari',
      icon: 'mdi:compass-outline',
      time: '22m',
      fill: 16,
      sub: 'no limit set',
      resting: false,
      heavy: false,
      todayTime: '22m',
      dailyAverage: '20m daily average',
      limitOn: false,
      limitMinutes: null,
    },
  ],
  week: [
    {
      id: 'instagram',
      name: 'Instagram',
      icon: 'mdi:instagram',
      time: '11h 40m',
      fill: 100,
      sub: '1h 40m daily average',
      resting: true,
      heavy: true,
      todayTime: '2h 14m',
      dailyAverage: '1h 40m daily average',
      limitOn: true,
      limitMinutes: 120,
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: 'ic:baseline-tiktok',
      time: '6h 05m',
      fill: 52,
      sub: '52m daily average',
      resting: false,
      heavy: true,
      todayTime: '1h 02m',
      dailyAverage: '52m daily average',
      limitOn: true,
      limitMinutes: 90,
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: 'mdi:youtube',
      time: '4h 32m',
      fill: 39,
      sub: '39m daily average',
      resting: false,
      heavy: false,
      todayTime: '48m',
      dailyAverage: '39m daily average',
      limitOn: false,
      limitMinutes: null,
    },
    {
      id: 'safari',
      name: 'Safari',
      icon: 'mdi:compass-outline',
      time: '2h 18m',
      fill: 20,
      sub: '20m daily average',
      resting: false,
      heavy: false,
      todayTime: '22m',
      dailyAverage: '20m daily average',
      limitOn: false,
      limitMinutes: null,
    },
  ],
};

/** Preset chips on the app-detail limit slider. */
export const LIMIT_PRESETS: { label: string; minutes: number }[] = [
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 },
];

export const LIMIT_MIN = 15;
export const LIMIT_MAX = 240;

export function formatLimit(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}
