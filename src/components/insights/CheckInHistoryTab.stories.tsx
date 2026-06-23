import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckInHistoryTab } from './CheckInHistoryTab';

// note: this component reads analytics data hooks and may need query/data providers to render live.
const meta = {
  title: 'Insights/Check In History Tab',
  component: CheckInHistoryTab,
  args: {
    history: {
      groups: [
        {
          month: 'JUN',
          day: 23,
          dayName: 'Tuesday',
          daysAgo: 'TODAY',
          entries: [
            {
              title: 'Morning Check-In',
              time: '8:15 AM',
              iconBg: 'bg-primary/10',
              variant: 'detailed',
              metrics: [
                { icon: 'mdi:sleep', label: 'Sleep 4' },
                { icon: 'mdi:emoticon-happy-outline', label: 'Mood 5' },
              ],
              notes: 'Clear start and good focus.',
            },
          ],
        },
      ],
      availableMonths: ['June 2026', 'May 2026'],
      selectedMonth: 'June 2026',
      setSelectedMonth: () => {},
      isLoading: false,
      error: null,
    },
  },
} satisfies Meta<typeof CheckInHistoryTab>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
