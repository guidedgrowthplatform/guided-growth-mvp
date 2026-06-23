import type { Meta, StoryObj } from '@storybook/react-vite';
import type { TimerStatus } from '@/hooks/useFocusTimer';
import { FocusControls } from './FocusControls';

const meta = {
  title: 'Focus/FocusControls',
  component: FocusControls,
  args: {
    status: 'idle' as TimerStatus,
    onStart: () => {},
    onPause: () => {},
    onResume: () => {},
    onStop: () => {},
  },
} satisfies Meta<typeof FocusControls>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Running: Story = {
  args: {
    status: 'running',
  },
};

export const Paused: Story = {
  args: {
    status: 'paused',
  },
};

export const Completed: Story = {
  args: {
    status: 'completed',
  },
};
