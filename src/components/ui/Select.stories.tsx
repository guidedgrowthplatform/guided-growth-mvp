import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from './Select';

const meta: Meta<typeof Select> = {
  title: 'UI/Select',
  component: Select,
  args: {
    label: 'Reminder',
    options: [
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {};
export const WithError: Story = { args: { error: 'Please choose an option' } };
