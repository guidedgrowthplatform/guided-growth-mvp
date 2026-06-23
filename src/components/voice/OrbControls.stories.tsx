import type { Meta, StoryObj } from '@storybook/react-vite';
import { OrbControls } from './OrbControls';

const meta = {
  title: 'Voice/Orb Controls',
  component: OrbControls,
  args: { size: 120, leftActive: true, rightActive: false, activeRings: null, ringCount: 3, ringStep: 7, intensity: 0.4, micAllowed: true, onToggleVoice: () => {}, onToggleMic: () => {}, onRequestMic: () => {} },
} satisfies Meta<typeof OrbControls>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Listening: Story = { args: { rightActive: true, activeRings: 'right', intensity: 0.8 } };
export const MicBlocked: Story = { args: { micAllowed: false } };
