import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';

const meta = {
  title: 'UI/Card',
  component: Card,
  args: {
    children: <div style={{ padding: 4 }}>Card content goes here.</div>,
  },
} satisfies Meta<typeof Card>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Hoverable: Story = { args: { hoverable: true } };
