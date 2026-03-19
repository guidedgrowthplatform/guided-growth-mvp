export type MetricType = 'sleep' | 'energy' | 'mood' | 'stress';

export interface LevelConfig {
  color: string;
  icon: string;
  label: string;
}

export interface MetricConfig {
  label: string;
  legendTitle: string;
  levels: Record<1 | 2 | 3 | 4 | 5, LevelConfig>;
}

export const metricConfigs: Record<MetricType, MetricConfig> = {
  mood: {
    label: 'Mood',
    legendTitle: 'MOOD LEGEND',
    levels: {
      5: { color: '#22c55e', icon: 'mdi:emoticon-excited', label: 'Awesome' },
      4: { color: '#4ade80', icon: 'mdi:emoticon-happy', label: 'Good' },
      3: { color: '#facc15', icon: 'mdi:emoticon-neutral', label: 'Meh' },
      2: { color: '#fb923c', icon: 'mdi:emoticon-sad', label: 'Bad' },
      1: { color: '#ef4444', icon: 'mdi:emoticon-cry', label: 'Awful' },
    },
  },
  sleep: {
    label: 'Sleep',
    legendTitle: 'SLEEP LEGEND',
    levels: {
      5: { color: '#22c55e', icon: 'mdi:sleep', label: 'Excellent' },
      4: { color: '#4ade80', icon: 'mdi:bed', label: 'Good' },
      3: { color: '#facc15', icon: 'mdi:moon-waning-crescent', label: 'Fair' },
      2: { color: '#fb923c', icon: 'mdi:weather-night', label: 'Poor' },
      1: { color: '#ef4444', icon: 'mdi:alert-circle', label: 'Terrible' },
    },
  },
  energy: {
    label: 'Energy',
    legendTitle: 'ENERGY LEGEND',
    levels: {
      5: { color: '#22c55e', icon: 'mdi:lightning-bolt', label: 'High' },
      4: { color: '#4ade80', icon: 'mdi:flash', label: 'Good' },
      3: { color: '#facc15', icon: 'mdi:battery-50', label: 'Medium' },
      2: { color: '#fb923c', icon: 'mdi:battery-20', label: 'Low' },
      1: { color: '#ef4444', icon: 'mdi:battery-alert', label: 'Drained' },
    },
  },
  stress: {
    label: 'Stress',
    legendTitle: 'STRESS LEGEND',
    levels: {
      5: { color: '#ef4444', icon: 'mdi:head-alert', label: 'Extreme' },
      4: { color: '#fb923c', icon: 'mdi:head-dots-horizontal', label: 'High' },
      3: { color: '#facc15', icon: 'mdi:head-cog', label: 'Moderate' },
      2: { color: '#4ade80', icon: 'mdi:head-heart', label: 'Low' },
      1: { color: '#22c55e', icon: 'mdi:meditation', label: 'Calm' },
    },
  },
};

export const metricTabs: MetricType[] = ['sleep', 'energy', 'mood', 'stress'];
