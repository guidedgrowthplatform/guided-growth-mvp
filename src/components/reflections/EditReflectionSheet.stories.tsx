import type { Meta, StoryObj } from '@storybook/react-vite';
import type { JournalEntry } from '@gg/shared/types';
import { EditReflectionSheet } from './EditReflectionSheet';

const entry: JournalEntry = { id: 'j1', anon_id: 'anon-1', type: 'freeform', template_id: null, title: 'Morning clarity', date: '2026-06-23', fields: { body: '<p>Today I noticed the walk helps.</p>' }, created_at: '2026-06-23T08:30:00Z', updated_at: '2026-06-23T08:30:00Z' };

// note: this component reads auth and toast providers to render live.
const meta = {
  title: 'Reflections/Edit Reflection Sheet',
  component: EditReflectionSheet,
  args: { entry, onClose: () => {}, onSaved: () => {} },
} satisfies Meta<typeof EditReflectionSheet>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
