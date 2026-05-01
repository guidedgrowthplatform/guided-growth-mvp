/**
 * Tests for the GLOB-01 mic state machine in voiceSettingsStore.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { deriveMicState, useVoiceSettingsStore } from '../voiceSettingsStore';

describe('deriveMicState', () => {
  it('returns active when micEnabled is true', () => {
    expect(deriveMicState({ micEnabled: true, micPausedReason: null })).toBe('active');
    expect(deriveMicState({ micEnabled: true, micPausedReason: 'system' })).toBe('active');
    expect(deriveMicState({ micEnabled: true, micPausedReason: 'user' })).toBe('active');
  });

  it('returns system-gray when micEnabled false and reason is system', () => {
    expect(deriveMicState({ micEnabled: false, micPausedReason: 'system' })).toBe('system-gray');
  });

  it('returns user-off when micEnabled false and reason is user or null', () => {
    expect(deriveMicState({ micEnabled: false, micPausedReason: 'user' })).toBe('user-off');
    expect(deriveMicState({ micEnabled: false, micPausedReason: null })).toBe('user-off');
  });
});

describe('voiceSettingsStore mic transitions', () => {
  beforeEach(() => {
    localStorage.clear();
    useVoiceSettingsStore.setState({ micEnabled: true, micPausedReason: null });
  });

  it('setMicEnabled(false) flags user reason (sticky)', () => {
    useVoiceSettingsStore.getState().setMicEnabled(false);
    const s = useVoiceSettingsStore.getState();
    expect(s.micEnabled).toBe(false);
    expect(s.micPausedReason).toBe('user');
  });

  it('setMicEnabled(true) clears pausedReason', () => {
    useVoiceSettingsStore.setState({ micEnabled: false, micPausedReason: 'system' });
    useVoiceSettingsStore.getState().setMicEnabled(true);
    const s = useVoiceSettingsStore.getState();
    expect(s.micEnabled).toBe(true);
    expect(s.micPausedReason).toBeNull();
  });

  it('systemPauseMic flags system reason from active', () => {
    useVoiceSettingsStore.getState().systemPauseMic();
    const s = useVoiceSettingsStore.getState();
    expect(s.micEnabled).toBe(false);
    expect(s.micPausedReason).toBe('system');
  });

  it('systemPauseMic does not override user-off (sticky)', () => {
    useVoiceSettingsStore.getState().setMicEnabled(false);
    useVoiceSettingsStore.getState().systemPauseMic();
    const s = useVoiceSettingsStore.getState();
    expect(s.micPausedReason).toBe('user');
  });

  it('reactivateIfSystemPaused flips system-gray back to active', () => {
    useVoiceSettingsStore.getState().systemPauseMic();
    useVoiceSettingsStore.getState().reactivateIfSystemPaused();
    const s = useVoiceSettingsStore.getState();
    expect(s.micEnabled).toBe(true);
    expect(s.micPausedReason).toBeNull();
  });

  it('reactivateIfSystemPaused does not affect user-off', () => {
    useVoiceSettingsStore.getState().setMicEnabled(false);
    useVoiceSettingsStore.getState().reactivateIfSystemPaused();
    const s = useVoiceSettingsStore.getState();
    expect(s.micEnabled).toBe(false);
    expect(s.micPausedReason).toBe('user');
  });

  it('reactivateIfSystemPaused is a no-op when active', () => {
    useVoiceSettingsStore.getState().reactivateIfSystemPaused();
    const s = useVoiceSettingsStore.getState();
    expect(s.micEnabled).toBe(true);
    expect(s.micPausedReason).toBeNull();
  });

  it('does not persist micPausedReason across loadSettings (session-only)', () => {
    useVoiceSettingsStore.getState().systemPauseMic();
    useVoiceSettingsStore.getState().loadSettings();
    const s = useVoiceSettingsStore.getState();
    expect(s.micPausedReason).toBeNull();
  });

  it('parseStoredSettings tolerates legacy micPausedReason key in storage', () => {
    localStorage.setItem(
      'mvp03_voice_settings',
      JSON.stringify({
        recordingMode: 'auto-stop',
        micEnabled: true,
        ttsEnabled: true,
        micPausedReason: 'system',
      }),
    );
    useVoiceSettingsStore.getState().loadSettings();
    const s = useVoiceSettingsStore.getState();
    expect(s.micPausedReason).toBeNull();
  });
});

describe('voiceSettingsStore hydrate (DB sync)', () => {
  beforeEach(() => {
    localStorage.clear();
    useVoiceSettingsStore.setState({
      ttsEnabled: true,
      micEnabled: true,
      recordingMode: 'auto-stop',
      hydrated: false,
    });
  });

  it('hydrate sets the hydrated flag', () => {
    useVoiceSettingsStore.getState().hydrate({ ttsEnabled: false });
    expect(useVoiceSettingsStore.getState().hydrated).toBe(true);
  });

  it('hydrate overwrites store fields with DB values', () => {
    useVoiceSettingsStore
      .getState()
      .hydrate({ ttsEnabled: false, micEnabled: false, recordingMode: 'always-on' });
    const s = useVoiceSettingsStore.getState();
    expect(s.ttsEnabled).toBe(false);
    expect(s.micEnabled).toBe(false);
    expect(s.recordingMode).toBe('always-on');
  });

  it('hydrate ignores undefined fields', () => {
    useVoiceSettingsStore.getState().hydrate({ ttsEnabled: false });
    const s = useVoiceSettingsStore.getState();
    expect(s.ttsEnabled).toBe(false);
    expect(s.micEnabled).toBe(true); // untouched
  });
});

describe('setRecordingMode transient flag', () => {
  beforeEach(() => {
    localStorage.clear();
    useVoiceSettingsStore.setState({ recordingMode: 'auto-stop', recordingModeTransient: false });
  });

  it('non-transient setRecordingMode keeps flag false', () => {
    useVoiceSettingsStore.getState().setRecordingMode('always-on');
    expect(useVoiceSettingsStore.getState().recordingModeTransient).toBe(false);
  });

  it('transient setRecordingMode sets flag true', () => {
    useVoiceSettingsStore.getState().setRecordingMode('always-on', { transient: true });
    expect(useVoiceSettingsStore.getState().recordingModeTransient).toBe(true);
  });

  it('subsequent non-transient call clears flag', () => {
    useVoiceSettingsStore.getState().setRecordingMode('always-on', { transient: true });
    useVoiceSettingsStore.getState().setRecordingMode('auto-stop');
    expect(useVoiceSettingsStore.getState().recordingModeTransient).toBe(false);
  });
});
