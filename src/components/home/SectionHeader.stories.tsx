import type { Meta, StoryObj } from '@storybook/react-vite';
import { SectionHeader } from './SectionHeader';

const meta = {
  title: 'Home/Section Header',
  component: SectionHeader,
  args: { title: 'Today' },
} satisfies Meta<typeof SectionHeader>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithAction: Story = {
  args: { actionLabel: 'See all', onAction: () => {} },
};
