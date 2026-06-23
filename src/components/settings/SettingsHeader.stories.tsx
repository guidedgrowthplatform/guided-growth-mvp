import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsHeader } from './SettingsHeader';

const meta = {
  title: 'Settings/Settings Header',
  component: SettingsHeader,
  args: { onBack: () => {}, onMenu: () => {} },
} satisfies Meta<typeof SettingsHeader>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
