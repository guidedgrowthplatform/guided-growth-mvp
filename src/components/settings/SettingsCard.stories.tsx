import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsCard } from './SettingsCard';

const meta = {
  title: 'Settings/Settings Card',
  component: SettingsCard,
  args: {
    children: <div style={{ padding: 16 }}>Settings group content.</div>,
  },
} satisfies Meta<typeof SettingsCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
