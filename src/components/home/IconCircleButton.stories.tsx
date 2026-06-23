import { Check } from 'lucide-react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconCircleButton } from './IconCircleButton';

const meta = {
  title: 'Home/Icon Circle Button',
  component: IconCircleButton,
  args: { icon: Check, onClick: () => {} },
} satisfies Meta<typeof IconCircleButton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Active: Story = { args: { active: true } };
