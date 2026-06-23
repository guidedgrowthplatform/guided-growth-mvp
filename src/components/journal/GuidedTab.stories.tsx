import type { Meta, StoryObj } from '@storybook/react-vite';
import { GuidedTab } from './GuidedTab';

const meta = {
  title: 'Journal/Guided Tab',
  component: GuidedTab,
  args: { answers: { '0': 'I showed up for the habit.', '1': 'Start earlier tomorrow.' }, onAnswerChange: () => {}, onSave: () => {}, saving: false, now: new Date('2026-06-23T20:00:00') },
} satisfies Meta<typeof GuidedTab>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Saving: Story = { args: { saving: true } };
