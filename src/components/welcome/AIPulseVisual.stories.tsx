import type { Meta, StoryObj } from '@storybook/react-vite';
import { AIPulseVisual } from './AIPulseVisual';

const meta = {
  title: 'Welcome/AI Pulse Visual',
  component: AIPulseVisual,
} satisfies Meta<typeof AIPulseVisual>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
