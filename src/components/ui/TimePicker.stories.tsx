import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimePicker } from './TimePicker';

const meta = {
  title: 'UI/Time Picker',
  component: TimePicker,
  args: { value: '08:30', onChange: () => {} },
} satisfies Meta<typeof TimePicker>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Evening: Story = { args: { value: '21:00' } };
