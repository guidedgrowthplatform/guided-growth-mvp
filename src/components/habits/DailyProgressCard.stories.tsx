import type { Meta, StoryObj } from '@storybook/react-vite';
import { DailyProgressCard } from './DailyProgressCard';

const meta = {
  title: 'Habits/Daily Progress Card',
  component: DailyProgressCard,
  args: { completed: 3, total: 5 },
} satisfies Meta<typeof DailyProgressCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const AllDone: Story = { args: { completed: 5, total: 5 } };
export const NoneYet: Story = { args: { completed: 0, total: 5 } };
