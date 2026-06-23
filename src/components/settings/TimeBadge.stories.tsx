import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimeBadge } from './TimeBadge';

const meta = {
  title: 'Settings/Time Badge',
  component: TimeBadge,
  args: { children: '8:30 AM' },
} satisfies Meta<typeof TimeBadge>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
