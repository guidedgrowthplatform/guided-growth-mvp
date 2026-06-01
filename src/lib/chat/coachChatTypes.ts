// Shared contract for the Coach Chat surface — a reusable post-onboarding
// conversational overlay mountable on any screen. Produced by useCoachChat,
// consumed by CoachChatView.

export interface HabitCard {
  name: string;
  days: boolean[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  habitCards?: HabitCard[];
}

export type VoiceChatState = 'idle' | 'listening' | 'processing';

export interface CoachChatApi {
  messages: ChatMessage[];
  voiceState: VoiceChatState;
  speaking: boolean;
  startListening: () => void;
  stopListening: () => void;
  sendText: (text: string) => void;
  updateHabitDays: (messageId: string, cardIndex: number, days: boolean[]) => void;
}
