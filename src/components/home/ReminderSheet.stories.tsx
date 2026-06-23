import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReminderSheet } from './ReminderSheet';

const meta = {
  title: 'Home/Reminder Sheet',
  component: ReminderSheet,
  args: { onClose: () => {}, initialMorningTime: '08:00', initialNightTime: '21:30', initialPushNotifications: true, onSave: () => {} },
} satisfies Meta<typeof ReminderSheet>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const PushDisabled: Story = { args: { initialPushNotifications: false } };
