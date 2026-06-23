import type { Meta, StoryObj } from '@storybook/react-vite';
import { GuidanceBadge } from './GuidanceBadge';

const meta = {
  title: 'Onboarding/Guidance Badge',
  component: GuidanceBadge,
  args: { text: 'AI guidance available' },
} satisfies Meta<typeof GuidanceBadge>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
