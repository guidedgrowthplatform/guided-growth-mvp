import { Info } from 'lucide-react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { InfoBox } from './InfoBox';

const meta = {
  title: 'UI/InfoBox',
  component: InfoBox,
  args: {
    icon: <Info size={18} />,
    children: 'Heads up. This is an informational note.',
  },
} satisfies Meta<typeof InfoBox>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
