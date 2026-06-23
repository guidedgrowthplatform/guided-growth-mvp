import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarGrid } from './CalendarGrid';
import type { DayMetrics } from './calendarTypes';

const sampleData: Record<string, DayMetrics> = {
  '2024-06-01': { mood: 4, sleep: 3, energy: 5, stress: 2 },
  '2024-06-03': { mood: 3, sleep: 4, energy: 3, stress: 3 },
  '2024-06-05': { mood: 5, sleep: 5, energy: 5, stress: 1 },
  '2024-06-10': { mood: 2, sleep: 2, energy: 2, stress: 4 },
  '2024-06-15': { mood: 4, sleep: 4, energy: 4, stress: 2 },
  '2024-06-20': { mood: 1, sleep: 1, energy: 1, stress: 5 },
  '2024-06-25': { mood: 5, sleep: 5, energy: 4, stress: 1 },
};

const meta = {
  title: 'Calendar/CalendarGrid',
  component: CalendarGrid,
  args: {
    month: new Date(2024, 5, 1), // June 2024
    data: sampleData,
    activeMetric: 'mood',
    selectedDay: 15,
    onSelectDay: () => {},
  },
} satisfies Meta<typeof CalendarGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SleepMetric: Story = {
  args: {
    activeMetric: 'sleep',
    selectedDay: null,
  },
};

export const EnergyMetric: Story = {
  args: {
    activeMetric: 'energy',
    selectedDay: 5,
  },
};

export const StressMetric: Story = {
  args: {
    activeMetric: 'stress',
    selectedDay: 20,
  },
};

export const EmptyData: Story = {
  args: {
    data: {},
    selectedDay: null,
  },
};
