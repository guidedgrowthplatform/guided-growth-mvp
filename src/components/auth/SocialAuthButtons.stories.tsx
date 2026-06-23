import type { Meta, StoryObj } from '@storybook/react-vite';
import { SocialAuthButtons } from './SocialAuthButtons';

// NOTE: This component calls useAuth(), useToast(), and useLocation() at render.
// It requires a React Router provider, a ToastContext provider, and an AuthContext
// provider to render live. Wrap with those providers in .storybook/preview.tsx
// (or via a decorator) before using these stories in a running Storybook.

const meta = {
  title: 'Auth/SocialAuthButtons',
  component: SocialAuthButtons,
  args: {
    disabled: false,
  },
} satisfies Meta<typeof SocialAuthButtons>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
