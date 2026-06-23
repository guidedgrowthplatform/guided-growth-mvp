import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToastContainer } from './Toast';

// Reads useToast(); needs a ToastProvider in the tree to show live toasts.
const meta = {
  title: 'UI/Toast',
  component: ToastContainer,
} satisfies Meta<typeof ToastContainer>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
