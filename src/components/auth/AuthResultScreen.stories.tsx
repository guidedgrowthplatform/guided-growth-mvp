import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuthResultScreen } from './AuthResultScreen';

const meta = {
  title: 'Auth/Auth Result Screen',
  component: AuthResultScreen,
  args: {
    title: 'Check your email',
    body: 'We sent a sign-in link to your email.\nTap it to continue.',
    primaryLabel: 'Back to sign in',
    onPrimary: () => {},
  },
} satisfies Meta<typeof AuthResultScreen>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithIcon: Story = {
  args: {
    iconName: 'mdi:email-check-outline',
    iconTone: 'primary',
  },
};

export const SuccessWithSecondaryAction: Story = {
  args: {
    title: 'Password updated',
    body: 'Your password has been changed successfully.\nYou can now sign in with your new password.',
    primaryLabel: 'Sign in',
    onPrimary: () => {},
    secondaryLabel: 'Go to home',
    onSecondary: () => {},
    iconName: 'mdi:check-circle-outline',
    iconTone: 'primary',
  },
};

export const ErrorState: Story = {
  args: {
    title: 'Link expired',
    body: 'This sign-in link has expired.\nRequest a new one to continue.',
    primaryLabel: 'Request new link',
    onPrimary: () => {},
    secondaryLabel: 'Back to sign in',
    onSecondary: () => {},
    iconName: 'mdi:alert-circle-outline',
    iconTone: 'danger',
  },
};
