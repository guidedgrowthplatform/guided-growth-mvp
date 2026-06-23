import type { Meta, StoryObj } from '@storybook/react-vite';
import { QuickActionCards } from './QuickActionCards';

const meta = {
  title: 'Home/Quick Action Cards',
  component: QuickActionCards,
  args: { onCheckInPress: () => {}, onJournalPress: () => {} },
} satisfies Meta<typeof QuickActionCards>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
