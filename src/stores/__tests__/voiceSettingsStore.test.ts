/**
 * Tests for the runtime mic-pause state in voiceSettingsStore.
 * Persistent voice/mic toggles now live in user_preferences (see voiceGate).
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useVoiceSettingsStore } from '../voiceSettingsStore';

describe('voiceSettingsStore system mic pause', () => {
  beforeEach(() => {
    useVoiceSettingsStore.setState({ micPausedReason: null });
  });

  it('systemPauseMic flags system reason', () => {
    useVoiceSettingsStore.getState().systemPauseMic();
    expect(useVoiceSettingsStore.getState().micPausedReason).toBe('system');
  });

  it('reactivateIfSystemPaused clears a system pause', () => {
    useVoiceSettingsStore.getState().systemPauseMic();
    useVoiceSettingsStore.getState().reactivateIfSystemPaused();
    expect(useVoiceSettingsStore.getState().micPausedReason).toBeNull();
  });

  it('reactivateIfSystemPaused is a no-op when not paused', () => {
    useVoiceSettingsStore.getState().reactivateIfSystemPaused();
    expect(useVoiceSettingsStore.getState().micPausedReason).toBeNull();
  });
});
