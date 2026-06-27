import type { Meta, StoryObj } from '@storybook/react-vite';
import { FlowDesigner } from './FlowDesigner';

const meta = {
  title: 'Flow/Flow Designer',
  component: FlowDesigner,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FlowDesigner>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
