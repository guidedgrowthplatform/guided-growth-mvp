// Shared contract for the Coach Chat surface — a reusable post-onboarding
// conversational overlay mountable on any screen. Produced by useCoachChat,
// consumed by CoachChatView.

export interface HabitCard {
  name: string;
  days: boolean[];
}

export interface CheckInCardData {
  sleep: number | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  date: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  habitCards?: HabitCard[];
  checkinCard?: CheckInCardData;
  // True when this turn completed a habit — renders the read-only Today's Habits report.
  habitReport?: boolean;
}

export type VoiceChatState = 'idle' | 'listening' | 'processing';

type CreatedItemType = 'habit' | 'reflection';

export interface LastCreatedItem {
  type: CreatedItemType;
  id: string;
}

export interface CoachChatCloseInfo {
  lastCreatedItem?: LastCreatedItem;
}

export interface CoachChatApi {
  messages: ChatMessage[];
  voiceState: VoiceChatState;
  speaking: boolean;
  // True Soniox liveness (armed + 'listening'), not the persisted mic toggle —
  // drives the orb's active/ring so a dead/restarting mic doesn't read as live.
  micListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  sendText: (text: string) => void;
  updateHabitDays: (messageId: string, cardIndex: number, days: boolean[]) => void;
  lastCreatedItem?: LastCreatedItem;
  // Infinite-scroll-up over the linear per-user timeline. Resolves with the
  // number of genuinely-new rows prepended (0 → nothing to anchor).
  loadOlder: () => Promise<number>;
  hasMore: boolean;
  loadingOlder: boolean;
}
