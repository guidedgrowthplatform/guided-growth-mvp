import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckInResultCard } from './CheckInResultCard';

const meta = {
  title: 'Check-in/Check-in Result Card',
  component: CheckInResultCard,
} satisfies Meta<typeof CheckInResultCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Full: Story = {
  args: { sleep: 3, mood: 4, energy: 2, stress: 1, date: '2026-06-22' },
};

export const Partial: Story = {
  args: {
    sleep: 2,
    mood: null,
    energy: 4,
    stress: null,
    date: '2026-06-22',
    eyebrow: 'Morning check-in',
  },
};
