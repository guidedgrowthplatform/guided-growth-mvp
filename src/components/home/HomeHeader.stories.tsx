import type { Meta, StoryObj } from '@storybook/react-vite';
import { HomeHeader } from './HomeHeader';

const meta = {
  title: 'Home/Home Header',
  component: HomeHeader,
  args: { userName: 'Yair', onPlusClick: () => {}, onBellClick: () => {} },
} satisfies Meta<typeof HomeHeader>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const FirstVisit: Story = { args: { isFirstVisit: true } };
