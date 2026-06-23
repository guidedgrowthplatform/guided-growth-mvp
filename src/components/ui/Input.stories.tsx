import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  args: { placeholder: 'Your name' },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};
export const Password: Story = { args: { type: 'password', placeholder: 'Password' } };
export const Disabled: Story = { args: { disabled: true, placeholder: 'Disabled' } };
