import type { Meta, StoryObj } from '@storybook/react-vite';
import { FeedbackSheet } from './FeedbackSheet';

// note: this component reads the toast provider and submits feedback in live use.
const meta = {
  title: 'Home/Feedback Sheet',
  component: FeedbackSheet,
  args: { onClose: () => {} },
} satisfies Meta<typeof FeedbackSheet>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
