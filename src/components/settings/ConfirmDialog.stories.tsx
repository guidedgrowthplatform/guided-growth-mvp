import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConfirmDialog } from './ConfirmDialog';

const meta = {
  title: 'Settings/Confirm Dialog',
  component: ConfirmDialog,
  args: { title: 'Delete habit?', message: 'This removes the habit and its history.', confirmLabel: 'Delete', cancelLabel: 'Keep', variant: 'default', isLoading: false, onConfirm: () => {}, onCancel: () => {} },
} satisfies Meta<typeof ConfirmDialog>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Danger: Story = { args: { variant: 'danger' } };
export const Loading: Story = { args: { isLoading: true } };
