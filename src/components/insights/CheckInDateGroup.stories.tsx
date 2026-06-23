import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckInDateGroup } from './CheckInDateGroup';

const meta = {
  title: 'Insights/Check In Date Group',
  component: CheckInDateGroup,
  args: {
    month: 'JUN', day: 23, dayName: 'Tuesday', daysAgo: 'TODAY',
    entries: [{ title: 'Morning Check-In', time: '8:15 AM', iconBg: 'bg-primary/10', variant: 'detailed', metrics: [{ icon: 'mdi:weather-sunny', label: 'Mood 4' }, { icon: 'mdi:flash', label: 'Energy 5' }], notes: 'Clear start and good focus.' }],
  },
} satisfies Meta<typeof CheckInDateGroup>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
