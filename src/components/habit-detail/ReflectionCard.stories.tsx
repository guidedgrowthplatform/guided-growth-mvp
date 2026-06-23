import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReflectionCard } from './ReflectionCard';

const meta = {
  title: 'Habit Detail/Reflection Card',
  component: ReflectionCard,
  args: { habitName: 'Meditation', onLogReflection: () => {} },
} satisfies Meta<typeof ReflectionCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
