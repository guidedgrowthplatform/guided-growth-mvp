import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingSectionHeader } from './SettingSectionHeader';

const meta = {
  title: 'Settings/Setting Section Header',
  component: SettingSectionHeader,
  args: { title: 'Account' },
} satisfies Meta<typeof SettingSectionHeader>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
