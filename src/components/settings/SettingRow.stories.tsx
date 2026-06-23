import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingRow } from './SettingRow';

const meta = {
  title: 'Settings/Setting Row',
  component: SettingRow,
  args: { icon: 'mdi:bell-outline', label: 'Notifications', iconBg: 'bg-primary/10', iconClass: 'text-primary', right: <span className="text-sm text-content-tertiary">On</span>, onClick: () => {}, isFirst: false },
} satisfies Meta<typeof SettingRow>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const First: Story = { args: { isFirst: true } };
