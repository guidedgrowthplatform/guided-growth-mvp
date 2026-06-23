import type { Meta, StoryObj } from '@storybook/react-vite';
import { DateStrip } from './DateStrip';

const meta = {
  title: 'Home/Date Strip',
  component: DateStrip,
  args: {
    selectedDate: '2026-06-23',
    onSelectDate: () => {},
    entries: { '2026-06-23': { journal: 'written' }, '2026-06-22': { checkIn: 'complete' } },
  },
} satisfies Meta<typeof DateStrip>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
