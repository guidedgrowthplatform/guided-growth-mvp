import type { Meta, StoryObj } from '@storybook/react-vite';
import { VoiceMicButton } from './VoiceMicButton';

const meta = {
  title: 'Onboarding/Voice Mic Button',
  component: VoiceMicButton,
  args: { isListening: false, isPreparing: false, onPress: () => {} },
} satisfies Meta<typeof VoiceMicButton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Listening: Story = { args: { isListening: true } };
export const Preparing: Story = { args: { isPreparing: true } };
