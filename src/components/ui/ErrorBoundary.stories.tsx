import type { Meta, StoryObj } from '@storybook/react-vite';
import { ErrorBoundary } from './ErrorBoundary';

const meta = {
  title: 'UI/Error Boundary',
  component: ErrorBoundary,
  args: {
    children: <div style={{ padding: 16 }}>Protected content renders normally here.</div>,
  },
} satisfies Meta<typeof ErrorBoundary>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
