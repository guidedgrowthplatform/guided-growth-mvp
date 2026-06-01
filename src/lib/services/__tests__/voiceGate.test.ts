import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  loadLocalPreferences,
  SETTINGS_STORAGE_KEY,
  type UserPreferences,
} from '@/lib/preferences/snapshot';
import { queryClient, queryKeys } from '@/lib/query';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';
import {
  getPreferencesSnapshot,
  isMicEnabled,
  isVoiceOutEnabled,
  micEnabledFrom,
} from '../voiceGate';

function seedCache(overrides: Partial<UserPreferences>) {
  queryClient.setQueryData<UserPreferences>(queryKeys.preferences.all, {
    ...DEFAULT_PREFERENCES,
    ...overrides,
  });
}

function reset() {
  queryClient.clear();
  localStorage.clear();
  useVoiceSettingsStore.setState({ micPausedReason: null });
}

beforeEach(reset);
afterEach(reset);

describe('isVoiceOutEnabled', () => {
  it('true when cached voiceMode is voice', () => {
    seedCache({ voiceMode: 'voice' });
    expect(isVoiceOutEnabled()).toBe(true);
  });

  it('false when cached voiceMode is screen', () => {
    seedCache({ voiceMode: 'screen' });
    expect(isVoiceOutEnabled()).toBe(false);
  });

  it('falls back to local prefs when the cache is empty', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ voiceMode: 'screen' }));
    expect(isVoiceOutEnabled()).toBe(false);
  });

  it('defaults to voice-on when cache and local are both empty', () => {
    expect(isVoiceOutEnabled()).toBe(true);
  });
});

describe('isMicEnabled', () => {
  it('true only when permission + enabled + not paused', () => {
    seedCache({ micPermission: true, micEnabled: true });
    expect(isMicEnabled()).toBe(true);
  });

  it('false without mic permission', () => {
    seedCache({ micPermission: false, micEnabled: true });
    expect(isMicEnabled()).toBe(false);
  });

  it('false when mic is disabled', () => {
    seedCache({ micPermission: true, micEnabled: false });
    expect(isMicEnabled()).toBe(false);
  });

  it('false during a system pause even when permitted + enabled', () => {
    seedCache({ micPermission: true, micEnabled: true });
    useVoiceSettingsStore.getState().systemPauseMic();
    expect(isMicEnabled()).toBe(false);
  });
});

describe('micEnabledFrom', () => {
  it('requires all three inputs', () => {
    expect(micEnabledFrom({ micPermission: true, micEnabled: true }, null)).toBe(true);
    expect(micEnabledFrom({ micPermission: false, micEnabled: true }, null)).toBe(false);
    expect(micEnabledFrom({ micPermission: true, micEnabled: false }, null)).toBe(false);
    expect(micEnabledFrom({ micPermission: true, micEnabled: true }, 'system')).toBe(false);
  });
});

describe('getPreferencesSnapshot', () => {
  it('spreads a partial cache over defaults', () => {
    queryClient.setQueryData(queryKeys.preferences.all, { voiceMode: 'screen' });
    const snap = getPreferencesSnapshot();
    expect(snap.voiceMode).toBe('screen');
    expect(snap.micEnabled).toBe(DEFAULT_PREFERENCES.micEnabled);
  });

  it('reads local prefs when the cache is empty', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ micPermission: true, micEnabled: false }),
    );
    const snap = getPreferencesSnapshot();
    expect(snap.micPermission).toBe(true);
    expect(snap.micEnabled).toBe(false);
  });
});

describe('loadLocalPreferences', () => {
  it('returns defaults on malformed JSON', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{ not json');
    expect(loadLocalPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});
