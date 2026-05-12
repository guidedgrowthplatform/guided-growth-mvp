import { createContext } from 'react';

// ─── Legacy public types ────────────────────────────────────────────────────

/**
 * Unified voice state — single source of truth for the entire app.
 *
 * - idle:      nothing happening, voice channel free
 * - mp3:       playing a pre-recorded MP3 from the manifest
 * - listening: mic is open, capturing user speech (realtime)
 * - thinking:  STT complete, waiting for LLM response (realtime)
 * - speaking:  TTS audio playing back the LLM response (realtime)
 */
export type VoiceState = 'idle' | 'mp3' | 'listening' | 'thinking' | 'speaking';

/**
 * Coarse mode derived from VoiceState.
 * Useful for guards ("is anything realtime happening?") without
 * checking every sub-state.
 */
export type VoiceMode = 'idle' | 'mp3' | 'realtime';

/** Derive the coarse mode from the fine-grained state */
export function modeFromState(state: VoiceState): VoiceMode {
  if (state === 'mp3') return 'mp3';
  if (state === 'listening' || state === 'thinking' || state === 'speaking') return 'realtime';
  return 'idle';
}

// ─── New internal types (Phase 0.5 shadow) ──────────────────────────────────

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
  | 'journal'
  | '_legacy';

export type RealtimePhase = 'listening' | 'thinking' | 'speaking';
export type ReflectPhase =
  | 'playing-prompt'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking';

declare const __releaseTokenBrand: unique symbol;
export type ReleaseToken = string & { readonly [__releaseTokenBrand]: 'ReleaseToken' };

export type VoiceOwner =
  | { kind: 'idle' }
  | { kind: 'realtime'; surface: Surface; phase: RealtimePhase; token: ReleaseToken }
  | { kind: 'broadcast'; surface: Surface; assetId: string; token: ReleaseToken }
  | { kind: 'reflect-loop'; surface: Surface; phase: ReflectPhase; token: ReleaseToken }
  | { kind: 'capture-only'; surface: Surface; token: ReleaseToken };

// ─── Context Shape ──────────────────────────────────────────────────────────

export interface VoiceContextValue {
  // ── Read ────────────────────────────────────────────────────────────────

  /** Fine-grained state — exactly one of the VoiceState values */
  voiceState: VoiceState;

  /** Coarse mode derived from voiceState (convenience) */
  mode: VoiceMode;

  // ── Acquire / Release ───────────────────────────────────────────────────

  /**
   * Request MP3 mode. Cleans up any active realtime session first.
   * Sets voiceState → 'mp3'.
   * Returns true if the channel was acquired.
   */
  enterMp3: () => boolean;

  /**
   * Request realtime mode. Cleans up any active MP3 first.
   * Sets voiceState → 'listening' (the natural entry for realtime).
   * Returns true if the channel was acquired.
   */
  enterRealtime: () => boolean;

  /** Release the voice channel back to 'idle'. Runs cleanup. */
  release: () => void;

  /** Force-stop everything and return to 'idle'. */
  stopAll: () => void;

  // ── State transitions (for active owner only) ───────────────────────────

  /**
   * Transition voiceState within the current mode.
   *
   * Guards:
   * - If current mode is 'realtime', allows: listening → thinking → speaking
   *   (and any order — the hook knows the right sequence).
   * - If current mode is 'mp3', this is a no-op (mp3 has no sub-states).
   * - If current mode is 'idle', this is a no-op.
   */
  transition: (next: VoiceState) => void;

  // ── Cleanup registry ────────────────────────────────────────────────────

  /**
   * Register a cleanup function for the current owner's resources.
   * Called automatically by release(), stopAll(), or when another
   * mode takes over.
   */
  registerCleanup: (fn: () => void) => void;

  // ── New internal API (Phase 0.5 — exposed but no consumer reads it yet) ──

  owner: VoiceOwner;

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
  setBroadcastState: (token: ReleaseToken, state: 'loading' | 'playing') => void;
  setCaptureState: (token: ReleaseToken, state: 'listening' | 'transcribing') => void;

  // named distinctly from legacy release(); future migration renames
  releaseToken: (token: ReleaseToken) => void;
}

export const VoiceContext = createContext<VoiceContextValue | null>(null);
