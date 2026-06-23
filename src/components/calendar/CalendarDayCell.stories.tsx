import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarDayCell } from './CalendarDayCell';

const meta = {
  title: 'Calendar/Calendar Day Cell',
  component: CalendarDayCell,
  args: {
    day: 15,
    value: null,
    levelConfig: null,
    isSelected: false,
    onClick: () => {},
  },
} satisfies Meta<typeof CalendarDayCell>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = {
  args: {
    isSelected: true,
  },
};

export const WithValue: Story = {
  args: {
    value: 4,
    levelConfig: { color: '#4ade80', icon: 'mdi:emoticon-happy', label: 'Good' },
  },
};

export const WithValueSelected: Story = {
  args: {
    value: 5,
    levelConfig: { color: '#22c55e', icon: 'mdi:emoticon-excited', label: 'Awesome' },
    isSelected: true,
  },
};

export const Empty: Story = {
  args: {
    day: null,
    value: null,
    levelConfig: null,
  },
};
