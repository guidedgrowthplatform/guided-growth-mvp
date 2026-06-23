import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarLegend } from './CalendarLegend';

const meta = {
  title: 'Calendar/CalendarLegend',
  component: CalendarLegend,
  args: {
    metricType: 'mood',
  },
} satisfies Meta<typeof CalendarLegend>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sleep: Story = {
  args: {
    metricType: 'sleep',
  },
};

export const Energy: Story = {
  args: {
    metricType: 'energy',
  },
};

export const Stress: Story = {
  args: {
    metricType: 'stress',
  },
};
