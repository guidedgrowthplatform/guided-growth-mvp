import type { Meta, StoryObj } from '@storybook/react-vite';
import { WeeklySummaryCard } from './WeeklySummaryCard';

const meta = {
  title: 'Notifications/Weekly Summary Card',
  component: WeeklySummaryCard,
  args: { onViewReport: () => {} },
} satisfies Meta<typeof WeeklySummaryCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
