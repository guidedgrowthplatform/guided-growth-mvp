import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuthAlert } from './AuthAlert';

const meta = {
  title: 'Auth/AuthAlert',
  component: AuthAlert,
  args: {
    type: 'error',
    message: 'Something went wrong. Please try again.',
  },
} satisfies Meta<typeof AuthAlert>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Error: Story = {
  args: {
    type: 'error',
    message: 'Invalid email or password.',
  },
};

export const Success: Story = {
  args: {
    type: 'success',
    message: 'Your account has been created successfully.',
  },
};

export const Info: Story = {
  args: {
    type: 'info',
    message: 'Check your email for a confirmation link.',
  },
};
