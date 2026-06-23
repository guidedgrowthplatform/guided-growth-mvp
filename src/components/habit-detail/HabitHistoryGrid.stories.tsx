import type { Meta, StoryObj } from '@storybook/react-vite';
import { HabitHistoryGrid, type HabitHistoryRow } from './HabitHistoryGrid';

const meta = {
  title: 'Habit Detail/Habit History Grid',
  component: HabitHistoryGrid,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof HabitHistoryGrid>;
export default meta;

type Story = StoryObj<typeof meta>;

const rows: HabitHistoryRow[] = [
  { id: 'wake', name: 'Wake up', cells: ['done', 'done', 'missed'] },
  { id: 'meditate', name: 'Meditation', cells: ['done', 'missed', 'done'] },
  { id: 'gym', name: 'Gym', cells: ['done', 'off', 'done'] },
  { id: 'noweed', name: 'No weed', cells: ['done', 'done', 'done'] },
  { id: 'journal', name: 'Journaling', cells: ['missed', 'done', 'done'] },
];

export const LastThreeDays: Story = {
  name: 'Last 3 days (chat)',
  args: {
    days: ['Mon', 'Tue', 'Wed'],
    rows,
  },
};

export const LastSevenDays: Story = {
  name: 'Last 7 days',
  args: {
    days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    rows: [
      { id: 'wake', name: 'Wake up', cells: ['done', 'done', 'missed', 'done', 'done', 'off', 'done'] },
      { id: 'meditate', name: 'Meditation', cells: ['done', 'missed', 'done', 'done', 'missed', 'done', 'done'] },
      { id: 'gym', name: 'Gym', cells: ['done', 'off', 'done', 'off', 'done', 'off', 'missed'] },
      { id: 'noweed', name: 'No weed', cells: ['done', 'done', 'done', 'done', 'done', 'done', 'done'] },
      { id: 'clean', name: 'Eating clean', cells: ['missed', 'done', 'done', 'missed', 'done', 'done', 'off'] },
      { id: 'journal', name: 'Journaling', cells: ['missed', 'done', 'done', 'done', 'done', 'done', 'missed'] },
    ],
  },
};

export const SingleHabit: Story = {
  name: 'Single habit strip',
  args: {
    days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    rows: [{ id: 'gym', name: 'Gym', cells: ['done', 'done', 'missed', 'done', 'done', 'off', 'done'] }],
  },
};
