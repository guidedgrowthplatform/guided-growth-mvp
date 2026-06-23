import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemeToggle } from './ThemeToggle';

// Reads useTheme(); renders standalone in Storybook (theme state falls back to default).
const meta = {
  title: 'UI/Theme Toggle',
  component: ThemeToggle,
} satisfies Meta<typeof ThemeToggle>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
