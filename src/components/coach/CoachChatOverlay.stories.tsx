import type { Meta, StoryObj } from '@storybook/react-vite';
import { CoachChatOverlay } from './CoachChatOverlay';

// NOTE: CoachChatOverlay reads the CoachVoiceProvider context via useCoachVoice().
// When the context is absent the component returns null, so the story renders an
// empty canvas without a provider decorator. To see the full UI, wrap the story
// in a CoachVoiceProvider (or a mock) that supplies a valid CoachChatApi object.

const meta = {
  title: 'Coach/Coach Chat Overlay',
  component: CoachChatOverlay,
  args: {
    onClose: () => {},
  },
} satisfies Meta<typeof CoachChatOverlay>;
export default meta;

type Story = StoryObj<typeof meta>;

// Renders nothing at runtime without a CoachVoiceProvider, but typechecks correctly.
export const Default: Story = {};

export const WithCloseCallback: Story = {
  args: {
    onClose: () => {
      // eslint-disable-next-line no-console
      console.log('CoachChatOverlay closed');
    },
  },
};
