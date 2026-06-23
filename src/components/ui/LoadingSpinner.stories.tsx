import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadingSpinner } from './LoadingSpinner';

const meta = {
  title: 'UI/Loading Spinner',
  component: LoadingSpinner,
} satisfies Meta<typeof LoadingSpinner>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { size: 'sm' } };
export const Large: Story = { args: { size: 'lg' } };
