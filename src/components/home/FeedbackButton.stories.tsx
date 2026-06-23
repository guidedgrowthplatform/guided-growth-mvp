import type { Meta, StoryObj } from '@storybook/react-vite';
import { FeedbackButton } from './FeedbackButton';

const meta = {
  title: 'Home/Feedback Button',
  component: FeedbackButton,
  args: { onPress: () => {} },
} satisfies Meta<typeof FeedbackButton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
