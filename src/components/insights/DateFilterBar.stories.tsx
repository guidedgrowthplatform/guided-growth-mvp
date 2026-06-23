import type { Meta, StoryObj } from '@storybook/react-vite';
import { DateFilterBar } from './DateFilterBar';

const meta = {
  title: 'Insights/Date Filter Bar',
  component: DateFilterBar,
  args: { availableMonths: ['June 2026', 'May 2026', 'April 2026'], selected: 'June 2026', onSelect: () => {} },
} satisfies Meta<typeof DateFilterBar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
