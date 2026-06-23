import type { Meta, StoryObj } from '@storybook/react-vite';
import { BarChart } from './BarChart';

const meta = {
  title: 'Insights/Bar Chart',
  component: BarChart,
  args: { data: [{ label: 'Mon', value: 55 }, { label: 'Tue', value: 80 }, { label: 'Wed', value: 65 }] },
} satisfies Meta<typeof BarChart>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
