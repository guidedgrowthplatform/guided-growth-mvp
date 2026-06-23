import type { Meta, StoryObj } from '@storybook/react-vite';
import { SignInScreen } from './SignInScreen';

const meta = {
  title: 'Welcome/Sign In Screen',
  component: SignInScreen,
  args: { onApple: () => {}, onGoogle: () => {}, onSignUp: () => {}, heading: 'Your coach is ready', subheading: 'Create an account to begin', showOrb: true },
} satisfies Meta<typeof SignInScreen>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoOrb: Story = { args: { showOrb: false } };
