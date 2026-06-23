import type { Meta, StoryObj } from '@storybook/react-vite';
import { RichTextEditor } from './RichTextEditor';

const meta = {
  title: 'Reflections/Rich Text Editor',
  component: RichTextEditor,
  args: { value: '<p>Write what happened today.</p>', onChange: () => {}, placeholder: 'Start writing...' },
} satisfies Meta<typeof RichTextEditor>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { value: '' } };
