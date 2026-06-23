import type { Meta, StoryObj } from '@storybook/react-vite';
import { Modal } from './Modal';

const meta = {
  title: 'UI/Modal',
  component: Modal,
  args: {
    open: true,
    onClose: () => {},
    title: 'Confirm',
    children: <p style={{ padding: '0 4px' }}>This is the modal body content.</p>,
  },
} satisfies Meta<typeof Modal>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoTitle: Story = { args: { title: undefined } };
