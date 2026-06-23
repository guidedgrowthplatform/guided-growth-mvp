import type { Meta, StoryObj } from '@storybook/react-vite';
import { BottomSheet } from './BottomSheet';

const meta = {
  title: 'UI/Bottom Sheet',
  component: BottomSheet,
  args: {
    onClose: () => {},
    children: <div style={{ padding: 16 }}>Bottom sheet content.</div>,
  },
} satisfies Meta<typeof BottomSheet>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
