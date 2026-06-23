import type { Meta, StoryObj } from '@storybook/react-vite';
import { VoiceSettingsSheet } from './VoiceSettingsSheet';

const meta = {
  title: 'Settings/Voice Settings Sheet',
  component: VoiceSettingsSheet,
  args: { title: 'Voice mode', options: [{ label: 'Voice first', value: 'voice', description: 'Hear responses out loud when available.' }, { label: 'Screen first', value: 'screen', description: 'Keep responses on screen unless you ask for voice.' }], selected: 'voice', onSelect: () => {}, onClose: () => {}, extraContent: <p className="text-sm text-content-secondary">Choose how your coach responds.</p> },
} satisfies Meta<typeof VoiceSettingsSheet>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
