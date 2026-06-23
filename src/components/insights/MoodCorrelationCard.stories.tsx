import type { Meta, StoryObj } from '@storybook/react-vite';
import { MoodCorrelationCard } from './MoodCorrelationCard';

// note: this component reads analytics data hooks and may need query/data providers to render live.
const meta = {
  title: 'Insights/Mood Correlation Card',
  component: MoodCorrelationCard,
} satisfies Meta<typeof MoodCorrelationCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
