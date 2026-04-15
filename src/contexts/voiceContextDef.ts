import { createContext } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

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

/** User preference for how voice works across the app.
 * - voice: AI speaks via TTS, user talks via mic (default).
 * - screen: AI writes text responses; user MAY still use mic to speak.
 * - always_ask: prompt the user for mode on each voice-capable screen.
 */
export type VoicePreference = 'voice' | 'screen' | 'always_ask';

/** Derive the coarse mode from the fine-grained state */
export function modeFromState(state: VoiceState): VoiceMode {
  if (state === 'mp3') return 'mp3';
  if (state === 'listening' || state === 'thinking' || state === 'speaking') return 'realtime';
  return 'idle';
}

// ─── Context Shape ──────────────────────────────────────────────────────────

export interface VoiceContextValue {
  // ── Read ────────────────────────────────────────────────────────────────

  /** Fine-grained state — exactly one of the VoiceState values */
  voiceState: VoiceState;

  /** Coarse mode derived from voiceState (convenience) */
  mode: VoiceMode;

  /** User's voice preference setting */
  preference: VoicePreference;

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

  // ── Preference ──────────────────────────────────────────────────────────

  /** Set user's voice preference (persisted to localStorage) */
  setPreference: (pref: VoicePreference) => void;

  // ── Cleanup registry ────────────────────────────────────────────────────

  /**
   * Register a cleanup function for the current owner's resources.
   * Called automatically by release(), stopAll(), or when another
   * mode takes over.
   */
  registerCleanup: (fn: () => void) => void;
}

export const VoiceContext = createContext<VoiceContextValue | null>(null);
