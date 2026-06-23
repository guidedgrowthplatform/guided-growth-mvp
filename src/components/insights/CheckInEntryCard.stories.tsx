import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckInEntryCard } from './CheckInEntryCard';

const meta = {
  title: 'Insights/Check In Entry Card',
  component: CheckInEntryCard,
  args: { title: 'Morning Check-In', time: '8:15 AM', iconBg: 'bg-primary/10', variant: 'detailed', metrics: [{ icon: 'mdi:sleep', label: 'Sleep 4' }, { icon: 'mdi:emoticon-happy-outline', label: 'Mood 5' }], notes: 'Slept well and started with a walk.' },
} satisfies Meta<typeof CheckInEntryCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Compact: Story = { args: { variant: 'compact', notes: null } };
