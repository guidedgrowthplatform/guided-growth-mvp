import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedControl } from './SegmentedControl';

const meta = {
  title: 'Insights/Segmented Control',
  component: SegmentedControl,
  args: { items: [{ label: 'Week', value: 'week' }, { label: 'Month', value: 'month' }], value: 'week', onChange: () => {}, size: 'lg' },
} satisfies Meta<typeof SegmentedControl>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { size: 'sm' } };
