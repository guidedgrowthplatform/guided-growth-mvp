import type { Meta, StoryObj } from '@storybook/react-vite';
import { CategoryCard } from './CategoryCard';

const meta = {
  title: 'Onboarding/Category Card',
  component: CategoryCard,
  args: { onSelect: () => {} },
} satisfies Meta<typeof CategoryCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Photo: Story = {
  args: { image: '/images/onboarding/sleep-better.png', label: 'Sleep better', selected: false },
};

export const PhotoSelected: Story = {
  args: { image: '/images/onboarding/move-more.jpg', label: 'Move more', selected: true },
};

export const Emoji: Story = {
  args: { emoji: '🌙', label: 'Sleep better', selected: false },
};

export const EmojiSelected: Story = {
  args: { emoji: '⚡', label: 'More energy', selected: true },
};
