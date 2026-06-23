import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkdownMessage } from './MarkdownMessage';

const meta = {
  title: 'Chat/MarkdownMessage',
  component: MarkdownMessage,
  args: {
    text: 'Hello, this is a message.',
  },
} satisfies Meta<typeof MarkdownMessage>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    text: 'Hello, this is a message.',
  },
};

export const WithBoldAndItalic: Story = {
  args: {
    text: 'This is **bold** and this is *italic* text in a message.',
  },
};

export const WithUnorderedList: Story = {
  args: {
    text: `Here are some things to reflect on:\n- Take a deep breath\n- Notice how you feel\n- Be kind to yourself`,
  },
};

export const WithOrderedList: Story = {
  args: {
    text: `Try this exercise:\n1. Find a quiet space\n2. Close your eyes for 30 seconds\n3. Notice what comes up`,
  },
};

export const MultiParagraph: Story = {
  args: {
    text: `Great work today. You showed real courage in sharing that.\n\nRemember, growth isn't always comfortable — and that's okay.\n\nSee you tomorrow for your next check-in.`,
  },
};

export const WithInlineCode: Story = {
  args: {
    text: 'Your streak is now at `7 days`. Keep it going!',
  },
};
