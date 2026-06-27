import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectionCard } from './SelectionCard';

const meta = {
  title: 'Onboarding/Selection Card',
  component: SelectionCard,
  args: { onSelect: () => {} },
} satisfies Meta<typeof SelectionCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Beginner: Story = {
  args: {
    icon: 'mdi:sprout-outline',
    iconBg: 'rgba(19,91,235,0.10)',
    title: 'Guide me',
    description: 'Start simple. I will help you pick a focus and build from there.',
    selected: true,
  },
};

export const Advanced: Story = {
  args: {
    icon: 'mdi:lightning-bolt-outline',
    iconBg: 'rgba(245,158,11,0.12)',
    iconColor: 'rgb(245,158,11)',
    title: 'I know what I want',
    description: 'Tell me everything on your mind and I will shape it into a plan.',
    selected: false,
  },
};
