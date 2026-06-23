import type { Meta, StoryObj } from '@storybook/react-vite';
import { InsightsHeader } from './InsightsHeader';

const meta = {
  title: 'Insights/Insights Header',
  component: InsightsHeader,
} satisfies Meta<typeof InsightsHeader>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
