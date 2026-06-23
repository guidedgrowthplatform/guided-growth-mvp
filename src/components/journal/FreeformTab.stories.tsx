import type { Meta, StoryObj } from '@storybook/react-vite';
import { FreeformTab } from './FreeformTab';

const meta = {
  title: 'Journal/Freeform Tab',
  component: FreeformTab,
  args: { title: 'Morning clarity', body: '<p>I noticed I have more energy after walking first.</p>', onTitleChange: () => {}, onBodyChange: () => {}, onSave: () => {}, saving: false, userName: 'Yair', now: new Date('2026-06-23T08:30:00') },
} satisfies Meta<typeof FreeformTab>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Saving: Story = { args: { saving: true } };
