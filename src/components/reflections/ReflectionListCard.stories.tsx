import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import type { JournalEntry } from '@gg/shared/types';
import { ReflectionListCard } from './ReflectionListCard';

const entry: JournalEntry = { id: 'j1', anon_id: 'anon-1', type: 'freeform', template_id: null, title: 'Morning clarity', date: '2026-06-23', fields: { body: 'Today I noticed the walk helps.' }, created_at: '2026-06-23T08:30:00Z', updated_at: '2026-06-23T08:30:00Z' };

const meta = {
  title: 'Reflections/Reflection List Card',
  component: ReflectionListCard,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  args: { entry, isMenuOpen: false, onMenuToggle: () => {}, onMenuClose: () => {}, onEdit: () => {}, onDelete: () => {} },
} satisfies Meta<typeof ReflectionListCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const MenuOpen: Story = { args: { isMenuOpen: true } };
