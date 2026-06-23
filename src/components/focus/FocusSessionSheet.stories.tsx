import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToastProvider } from '@/contexts/ToastContext';
import type { Habit } from '@/lib/services/data-service.interface';
import { FocusSessionSheet } from './FocusSessionSheet';

const mockHabits: Habit[] = [
  {
    id: 'habit-1',
    name: 'Morning Meditation',
    frequency: 'daily',
    scheduleDays: null,
    createdAt: '2024-01-01T00:00:00Z',
    active: true,
  },
  {
    id: 'habit-2',
    name: 'Deep Work Block',
    frequency: 'daily',
    scheduleDays: null,
    createdAt: '2024-01-02T00:00:00Z',
    active: true,
  },
  {
    id: 'habit-3',
    name: 'Evening Reading',
    frequency: '3x/week',
    scheduleDays: [1, 3, 5],
    createdAt: '2024-01-03T00:00:00Z',
    active: true,
  },
];

const meta = {
  title: 'Focus/Focus Session Sheet',
  component: FocusSessionSheet,
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  args: {
    habits: mockHabits,
    selectedHabitId: null,
    notify: false,
    onSelectHabit: () => {},
    onSetDurationSeconds: () => {},
    onToggleNotify: () => {},
    onStart: () => {},
  },
} satisfies Meta<typeof FocusSessionSheet>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const HabitSelected: Story = {
  args: {
    selectedHabitId: 'habit-1',
    notify: false,
  },
};

export const NotifyEnabled: Story = {
  args: {
    selectedHabitId: 'habit-2',
    notify: true,
  },
};

export const NoHabits: Story = {
  args: {
    habits: [],
    selectedHabitId: null,
    notify: false,
  },
};
