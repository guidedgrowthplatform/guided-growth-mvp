import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatComposer } from './ChatComposer';

const meta = {
  title: 'Chat/Chat Composer',
  component: ChatComposer,
  args: {
    onSubmit: () => {},
  },
} satisfies Meta<typeof ChatComposer>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPlaceholder: Story = {
  args: {
    placeholder: 'Share what is on your mind…',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: 'This input is disabled',
    onValueChange: () => {},
  },
};

export const Prefilled: Story = {
  args: {
    value: 'I want to build a daily journaling habit',
    onValueChange: () => {},
  },
};
