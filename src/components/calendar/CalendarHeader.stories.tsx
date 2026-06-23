import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarHeader } from './CalendarHeader';

const meta = {
  title: 'Calendar/CalendarHeader',
  component: CalendarHeader,
  args: {
    month: new Date(2025, 5, 1), // June 2025
    onPrev: () => {},
    onNext: () => {},
  },
} satisfies Meta<typeof CalendarHeader>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BeginningOfYear: Story = {
  args: {
    month: new Date(2025, 0, 1), // January 2025
  },
};

export const EndOfYear: Story = {
  args: {
    month: new Date(2025, 11, 1), // December 2025
  },
};
