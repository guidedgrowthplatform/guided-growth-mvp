import type { Meta, StoryObj } from '@storybook/react-vite';
import { CoachChatView } from './CoachChatView';

// NOTE: CoachChatView reads several React contexts and Zustand stores at render
// (useCoachTranscripts, useVoiceStore, useDualButtonControls, useMicVoiceActivity,
// useSmoothReveal). A full provider tree is required for live rendering.
// These stories supply all required props and type-check cleanly; wrap with the
// appropriate providers (CoachVoiceProvider, etc.) in a decorator to render live.

const meta = {
  title: 'Coach/Coach Chat View',
  component: CoachChatView,
  args: {
    messages: [
      {
        id: 'msg-1',
        role: 'ai' as const,
        text: "Good morning! How are you feeling today? Let's take a moment to check in.",
      },
      {
        id: 'msg-2',
        role: 'user' as const,
        text: 'Feeling pretty good, a bit tired though.',
      },
      {
        id: 'msg-3',
        role: 'ai' as const,
        text: "That's great to hear! Getting enough sleep is so important. Would you like to build a sleep habit?",
      },
    ],
    voiceState: 'idle' as const,
    speaking: false,
    startListening: () => {},
    stopListening: () => {},
    sendText: () => {},
    updateHabitDays: () => {},
    displayName: 'Alex',
    onClose: () => {},
  },
} satisfies Meta<typeof CoachChatView>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHabitCard: Story = {
  args: {
    messages: [
      {
        id: 'msg-1',
        role: 'ai' as const,
        text: 'Here is a habit suggestion based on our conversation:',
        habitCards: [
          {
            name: 'Morning meditation',
            days: [true, false, true, false, true, false, true],
          },
        ],
      },
    ],
  },
};

export const Listening: Story = {
  args: {
    voiceState: 'listening' as const,
    speaking: false,
  },
};

export const Speaking: Story = {
  args: {
    voiceState: 'idle' as const,
    speaking: true,
  },
};

export const Processing: Story = {
  args: {
    voiceState: 'processing' as const,
    speaking: false,
  },
};
