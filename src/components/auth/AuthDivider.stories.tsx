import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuthDivider } from './AuthDivider';

const meta = {
  title: 'Auth/AuthDivider',
  component: AuthDivider,
  args: {
    text: 'or',
  },
} satisfies Meta<typeof AuthDivider>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Uppercase: Story = {
  args: {
    text: 'or continue with',
    uppercase: true,
  },
};

export const Bold: Story = {
  args: {
    text: 'or',
    bold: true,
  },
};

export const UppercaseAndBold: Story = {
  args: {
    text: 'or continue with',
    uppercase: true,
    bold: true,
  },
};
