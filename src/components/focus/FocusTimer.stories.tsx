import type { Meta, StoryObj } from '@storybook/react-vite';
import type { TimerStatus } from '@/hooks/useFocusTimer';
import { FocusTimer } from './FocusTimer';

const meta = {
  title: 'Focus/Focus Timer',
  component: FocusTimer,
  args: {
    remainingSeconds: 1500,
    progress: 1,
    status: 'idle' as TimerStatus,
    onEditPress: () => {},
  },
} satisfies Meta<typeof FocusTimer>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Running: Story = {
  args: {
    remainingSeconds: 900,
    progress: 0.6,
    status: 'running' as TimerStatus,
  },
};

export const Paused: Story = {
  args: {
    remainingSeconds: 450,
    progress: 0.3,
    status: 'paused' as TimerStatus,
  },
};

export const Completed: Story = {
  args: {
    remainingSeconds: 0,
    progress: 0,
    status: 'completed' as TimerStatus,
  },
};
