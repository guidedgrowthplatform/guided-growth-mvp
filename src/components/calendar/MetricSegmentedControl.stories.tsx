import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MetricSegmentedControl } from './MetricSegmentedControl';

const meta = {
  title: 'Calendar/MetricSegmentedControl',
  component: MetricSegmentedControl,
  args: {
    value: 'sleep',
    onChange: () => {},
  },
} satisfies Meta<typeof MetricSegmentedControl>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MoodSelected: Story = {
  args: {
    value: 'mood',
  },
};

export const EnergySelected: Story = {
  args: {
    value: 'energy',
  },
};

export const StressSelected: Story = {
  args: {
    value: 'stress',
  },
};

export const Interactive: Story = {
  render: () => {
    const [metric, setMetric] = useState<'sleep' | 'energy' | 'mood' | 'stress'>('sleep');
    return <MetricSegmentedControl value={metric} onChange={setMetric} />;
  },
};
