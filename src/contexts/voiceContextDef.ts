import { createContext } from 'react';

// Single derived read for UI consumers ("is anything happening on the channel?").
export type VoiceState = 'idle' | 'mp3' | 'listening' | 'thinking' | 'speaking';

export type Surface =
  | 'onboarding'
  | 'morning'
  | 'evening'
  | 'chat'
  | 'habit_create'
  | 'feedback'
  | 'focus'
  | 'splash'
  | 'pref'
  | 'mic_permission'
  | 'post_auth'
  | 'affirmation'
  | 'voice_cap'
  | 'habit_detail'
  | 'journal';

export type RealtimePhase = 'listening' | 'thinking' | 'speaking';
export type ReflectPhase =
  | 'playing-prompt'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking';

declare const __releaseTokenBrand: unique symbol;
export type ReleaseToken = string & { readonly [__releaseTokenBrand]: 'ReleaseToken' };

export type BroadcastState = 'loading' | 'playing';
export type CaptureState = 'listening' | 'transcribing';

export type VoiceOwner =
  | { kind: 'idle' }
  | { kind: 'realtime'; surface: Surface; phase: RealtimePhase; token: ReleaseToken }
  | {
      kind: 'broadcast';
      surface: Surface;
      assetId: string;
      state: BroadcastState;
      token: ReleaseToken;
    }
  | { kind: 'reflect-loop'; surface: Surface; phase: ReflectPhase; token: ReleaseToken }
  | { kind: 'capture-only'; surface: Surface; state: CaptureState; token: ReleaseToken };

// ─── Context Shape ──────────────────────────────────────────────────────────

export interface VoiceContextValue {
  owner: VoiceOwner;

  // Derived from owner — kept for read-only "is the channel busy?" UI consumers.
  voiceState: VoiceState;

  acquireRealtime: (opts: { surface: Surface; onCleanup: () => void }) => ReleaseToken | null;
  acquireBroadcast: (opts: {
    surface: Surface;
    assetId: string;
    onCleanup: () => void;
  }) => ReleaseToken | null;
  acquireReflectLoop: (opts: { surface: Surface; onCleanup: () => void }) => ReleaseToken | null;
  acquireCaptureOnly: (opts: { surface: Surface; onCleanup: () => void }) => ReleaseToken | null;

  setStatus: (token: ReleaseToken, phase: RealtimePhase) => void;
  setPhase: (token: ReleaseToken, phase: ReflectPhase) => void;
  setBroadcastState: (token: ReleaseToken, state: BroadcastState) => void;
  setCaptureState: (token: ReleaseToken, state: CaptureState) => void;

  releaseToken: (token: ReleaseToken) => void;
}

export const VoiceContext = createContext<VoiceContextValue | null>(null);
