import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import { AuthFooter } from './AuthFooter';

const meta = {
  title: 'Auth/AuthFooter',
  component: AuthFooter,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  args: {
    text: "Don't have an account?",
    linkText: 'Sign up',
    to: '/signup',
  },
} satisfies Meta<typeof AuthFooter>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SignIn: Story = {
  args: {
    text: 'Already have an account?',
    linkText: 'Sign in',
    to: '/login',
  },
};

export const ForgotPassword: Story = {
  args: {
    text: 'Forgot your password?',
    linkText: 'Reset it here',
    to: '/forgot-password',
  },
};
