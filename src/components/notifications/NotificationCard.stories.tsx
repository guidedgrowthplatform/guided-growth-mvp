import type { Meta, StoryObj } from '@storybook/react-vite';
import type { AppNotification } from '@/lib/notifications/types';
import { NotificationCard } from './NotificationCard';

const notification: AppNotification = { id: 'n1', category: 'habit', icon: 'mdi:check-circle-outline', iconClass: 'text-success', iconBg: 'bg-success/10', title: 'Habit complete', body: 'Morning walk is done for today.', createdAt: '2026-06-23T08:30:00Z', unread: true, cta: { label: 'View', to: '/habit/h1' } };

const meta = {
  title: 'Notifications/Notification Card',
  component: NotificationCard,
  args: { notification, onPress: () => {}, onCtaPress: () => {} },
} satisfies Meta<typeof NotificationCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Read: Story = { args: { notification: { ...notification, unread: false } } };
