import type { Meta, StoryObj } from '@storybook/react-vite';
import { DayPicker } from './DayPicker';

const meta = {
  title: 'Voice/Day Picker',
  component: DayPicker,
  args: { days: [false, true, true, true, true, true, false], onChange: () => {} },
} satisfies Meta<typeof DayPicker>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
