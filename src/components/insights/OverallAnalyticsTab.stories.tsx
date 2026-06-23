import type { Meta, StoryObj } from '@storybook/react-vite';
import { OverallAnalyticsTab } from './OverallAnalyticsTab';

// note: this component reads analytics data hooks and may need query/data providers to render live.
const meta = {
  title: 'Insights/Overall Analytics Tab',
  component: OverallAnalyticsTab,
  args: { timeRange: 'week', onTimeRangeChange: () => {} },
} satisfies Meta<typeof OverallAnalyticsTab>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
