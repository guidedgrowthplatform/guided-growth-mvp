import { Icon } from '@iconify/react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteAccount } from '@/api/onboarding';
import { ConfirmDialog } from '@/components/settings/ConfirmDialog';
import { SettingRow } from '@/components/settings/SettingRow';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingSectionHeader } from '@/components/settings/SettingSectionHeader';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { TimeBadge } from '@/components/settings/TimeBadge';
import { UserInfoSection } from '@/components/settings/UserInfoSection';
import { VoiceSettingsSheet } from '@/components/settings/VoiceSettingsSheet';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';
import {
  getAvailableVoices,
  setVoicePreference,
  speak,
  getVoicePreference,
} from '@/lib/services/tts-service';
import {
  useVoiceSettingsStore,
  type RecordingMode,
  type SttProvider,
} from '@/stores/voiceSettingsStore';

// --- Option data ---

const sttOptions: { value: SttProvider; label: string; description: string }[] = [
  {
    value: 'webspeech',
    label: 'Web Speech API',
    description: 'Browser built-in. Free, real-time interim results. Requires internet.',
  },
  {
    value: 'whisper',
    label: 'Whisper (whisper.cpp)',
    description: 'OpenAI Whisper base model. Runs locally via WASM. ~75MB download on first use.',
  },
  {
    value: 'deepgram',
    label: 'DeepGram Nova-2',
    description: 'Cloud-based. Fastest transcription with real-time streaming. Requires API key.',
  },
  {
    value: 'elevenlabs',
    label: 'ElevenLabs Scribe v2',
    description: 'Cloud-based. High accuracy with audio preprocessing. Requires API key.',
  },
];

const recordingOptions: { value: RecordingMode; label: string; description: string }[] = [
  {
    value: 'auto-stop',
    label: 'Auto-stop (Siri-like)',
    description: 'Stops recording after 2.5s of silence. Best for quick voice commands.',
  },
  {
    value: 'always-on',
    label: 'Always recording',
    description: 'Keeps microphone active until manually stopped. Good for longer dictation.',
  },
];

const coachingStyles = [
  {
    value: 'friendly',
    label: 'Friendly & Empathetic',
    description: 'Warm, supportive tone with gentle encouragement.',
  },
  {
    value: 'direct',
    label: 'Direct & Motivational',
    description: 'Straightforward feedback with high-energy motivation.',
  },
  {
    value: 'analytical',
    label: 'Analytical & Data-Driven',
    description: 'Focus on numbers, trends, and measurable progress.',
  },
];

const voiceModels = [
  {
    value: 'alex',
    label: 'Alex (Male - Calm)',
    description: 'Calm, steady male voice for a relaxed coaching experience.',
  },
  {
    value: 'sarah',
    label: 'Sarah (Female - Warm)',
    description: 'Warm, encouraging female voice with natural intonation.',
  },
  {
    value: 'jordan',
    label: 'Jordan (Neutral - Energetic)',
    description: 'Energetic, gender-neutral voice for high-motivation sessions.',
  },
];

const languages = [
  { value: 'en-US', label: 'English (US)', description: 'American English speech recognition.' },
  { value: 'en-GB', label: 'English (UK)', description: 'British English speech recognition.' },
  {
    value: 'es-ES',
    label: 'Spanish (Spain)',
    description: 'Castilian Spanish speech recognition.',
  },
];

const sttLabels: Record<string, string> = {
  webspeech: 'Web Speech API',
  whisper: 'Whisper',
  deepgram: 'DeepGram Nova-2',
  elevenlabs: 'ElevenLabs Scribe v2',
};
const modeLabels: Record<string, string> = { 'auto-stop': 'Auto-stop', 'always-on': 'Always On' };

// --- Persistence helpers ---

const SETTINGS_STORAGE_KEY = 'mvp03_page_settings';

interface PageSettings {
  coachingStyle: string;
  voiceModel: string;
  language: string;
  morningTime: string;
  nightTime: string;
  pushNotifications: boolean;
}

function loadPageSettings(): PageSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) return { ...defaultPageSettings, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultPageSettings;
}

const defaultPageSettings: PageSettings = {
  coachingStyle: 'friendly',
  voiceModel: 'alex',
  language: 'en-US',
  morningTime: '07:00',
  nightTime: '22:30',
  pushNotifications: true,
};

function savePageSettings(settings: PageSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

// --- Time helpers ---

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

function generateTimeOptions(): { value: string; label: string; description: string }[] {
  const options: { value: string; label: string; description: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      options.push({ value, label: formatTime12h(value), description: '' });
    }
  }
  return options;
}

const timeOptions = generateTimeOptions();

// --- Sheet types ---

type SheetType =
  | 'stt'
  | 'recording'
  | 'ttsVoice'
  | 'coaching'
  | 'voiceModel'
  | 'language'
  | 'morningTime'
  | 'nightTime';

// --- Component ---

export function SettingsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user, signOut } = useAuth();
  const { state: onboardingState } = useOnboarding();
  const {
    recordingMode,
    setRecordingMode,
    ttsEnabled,
    setTtsEnabled,
    sttProvider,
    setSttProvider,
  } = useVoiceSettingsStore();

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>(getVoicePreference() || '');
  const [activeSheet, setActiveSheet] = useState<SheetType | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Page-level settings (persisted in localStorage)
  const [pageSettings, setPageSettings] = useState<PageSettings>(loadPageSettings);

  const updateSetting = useCallback(
    <K extends keyof PageSettings>(key: K, value: PageSettings[K]) => {
      setPageSettings((prev) => {
        const next = { ...prev, [key]: value };
        savePageSettings(next);
        return next;
      });
    },
    [],
  );

  // Load voices with polling for Android
  useEffect(() => {
    let retries = 0;
    const maxRetries = 12;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loadVoices = () => {
      const available = getAvailableVoices();
      if (available.length > 0) {
        setVoices(available);
        if (timer) clearTimeout(timer);
        return true;
      }
      return false;
    };

    if (!loadVoices()) {
      const poll = () => {
        retries++;
        if (loadVoices() || retries >= maxRetries) return;
        timer = setTimeout(poll, 250);
      };
      timer = setTimeout(poll, 250);
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleVoiceChange = useCallback((voiceName: string) => {
    setSelectedVoice(voiceName);
    setVoicePreference(voiceName);
    useVoiceSettingsStore.getState().setSelectedVoiceName(voiceName);
  }, []);

  const handlePreview = useCallback(() => {
    speak('Hello! I am your growth tracker assistant. How can I help you today?');
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    await deleteAccount();
    await signOut();
    localStorage.clear();
    navigate('/login', { replace: true });
  }, [signOut, navigate]);

  // Lookup labels
  const coachingLabel =
    coachingStyles.find((s) => s.value === pageSettings.coachingStyle)?.label ??
    'Friendly & Empathetic';
  const voiceModelLabel =
    voiceModels.find((m) => m.value === pageSettings.voiceModel)?.label ?? 'Alex (Male - Calm)';
  const languageLabel =
    languages.find((l) => l.value === pageSettings.language)?.label ?? 'English (US)';

  return (
    <div>
      <SettingsHeader onBack={() => navigate(-1)} />

      <UserInfoSection
        name={onboardingState?.data?.nickname || user?.name || user?.email?.split('@')[0] || 'User'}
        email={user?.email || ''}
        avatarUrl={user?.image || undefined}
        onEditProfile={() => addToast('info', 'Edit profile coming soon')}
        onChangePhoto={() => addToast('info', 'Photo upload coming soon')}
      />

      {/* AI Assistant */}
      <section className="mt-8">
        <SettingSectionHeader title="AI Assistant" />
        <SettingsCard>
          <SettingRow
            icon="mdi:robot-outline"
            label="AI Coaching Style"
            isFirst
            onClick={() => setActiveSheet('coaching')}
            right={
              <span className="text-sm font-medium text-content-secondary">{coachingLabel}</span>
            }
          />
          <SettingRow
            icon="tdesign:user-talk"
            label="Voice Model"
            onClick={() => setActiveSheet('voiceModel')}
            right={
              <span className="text-sm font-medium text-content-secondary">{voiceModelLabel}</span>
            }
          />
          <SettingRow
            icon="ic:round-translate"
            label="Voice-to-Text Language"
            onClick={() => setActiveSheet('language')}
            right={
              <span className="text-sm font-medium text-content-secondary">{languageLabel}</span>
            }
          />
        </SettingsCard>
      </section>

      {/* Check-In Routine */}
      <section className="mt-8">
        <SettingSectionHeader title="Check-In Routine" />
        <SettingsCard>
          <SettingRow
            icon="mingcute:sun-line"
            label="Morning Check In"
            isFirst
            onClick={() => setActiveSheet('morningTime')}
            right={<TimeBadge>{formatTime12h(pageSettings.morningTime)}</TimeBadge>}
          />
          <SettingRow
            icon="boxicons:moon"
            label="Night Check in"
            onClick={() => setActiveSheet('nightTime')}
            right={<TimeBadge>{formatTime12h(pageSettings.nightTime)}</TimeBadge>}
          />
          <SettingRow
            icon="iconamoon:notification"
            label="Push Notifications"
            right={
              <Toggle
                checked={pageSettings.pushNotifications}
                onChange={(v) => {
                  updateSetting('pushNotifications', v);
                  addToast('success', v ? 'Notifications enabled' : 'Notifications disabled');
                }}
              />
            }
          />
        </SettingsCard>
      </section>

      {/* Voice & Speech */}
      <section className="mt-8">
        <SettingSectionHeader title="Voice & Speech" />
        <SettingsCard>
          <SettingRow
            icon="mdi:brain"
            label="Speech Engine"
            isFirst
            onClick={() => setActiveSheet('stt')}
            right={
              <span className="text-sm font-medium text-content-secondary">
                {sttLabels[sttProvider]}
              </span>
            }
          />
          <SettingRow
            icon="ic:round-mic"
            label="Recording Mode"
            onClick={() => setActiveSheet('recording')}
            right={
              <span className="text-sm font-medium text-content-secondary">
                {modeLabels[recordingMode]}
              </span>
            }
          />
          <SettingRow
            icon="ic:round-volume-up"
            label="Voice Feedback"
            right={<Toggle checked={ttsEnabled} onChange={setTtsEnabled} />}
          />
          <SettingRow
            icon="ic:round-record-voice-over"
            label="TTS Voice"
            onClick={() => setActiveSheet('ttsVoice')}
            right={
              <span className="max-w-[120px] truncate text-sm font-medium text-content-secondary">
                {selectedVoice || 'Default'}
              </span>
            }
          />
        </SettingsCard>
      </section>

      {/* Privacy & Account */}
      <section className="mt-8">
        <SettingSectionHeader title="Privacy & Account" />
        <SettingsCard>
          <SettingRow
            icon="hugeicons:google-doc"
            label="Privacy Policy"
            isFirst
            onClick={() => addToast('info', 'Privacy policy coming soon')}
            right={
              <Icon icon="ic:round-chevron-right" width={20} className="text-content-tertiary" />
            }
          />
          <SettingRow
            icon="ic:round-logout"
            label="Log Out"
            onClick={async () => {
              setLoggingOut(true);
              await signOut();
              navigate('/login', { replace: true });
            }}
            right={loggingOut ? <LoadingSpinner size="sm" /> : undefined}
          />
          <SettingRow
            icon="octicon:trash-24"
            label="Delete Account & Data"
            iconBg="bg-[#fef2f2]"
            iconClass="text-danger"
            labelClass="text-danger"
            onClick={() => setShowDeleteConfirm(true)}
          />
        </SettingsCard>
      </section>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Account & Data"
          message="This will clear all local data including habits, entries, and preferences. This action cannot be undone."
          confirmLabel="Delete Everything"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Bottom Sheets */}
      {activeSheet === 'stt' && (
        <VoiceSettingsSheet
          title="Speech Engine"
          options={sttOptions}
          selected={sttProvider}
          onSelect={(v) => {
            setSttProvider(v as SttProvider);
            setActiveSheet(null);
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
      {activeSheet === 'recording' && (
        <VoiceSettingsSheet
          title="Recording Mode"
          options={recordingOptions}
          selected={recordingMode}
          onSelect={(v) => {
            setRecordingMode(v as RecordingMode);
            setActiveSheet(null);
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
      {activeSheet === 'ttsVoice' && (
        <VoiceSettingsSheet
          title="TTS Voice"
          options={voices.map((v) => ({ value: v.name, label: v.name, description: v.lang }))}
          selected={selectedVoice}
          onSelect={(v) => {
            handleVoiceChange(v);
            setActiveSheet(null);
          }}
          onClose={() => setActiveSheet(null)}
          extraContent={
            <button
              type="button"
              onClick={handlePreview}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-md"
            >
              <Icon icon="ic:round-volume-up" width={16} /> Preview Voice
            </button>
          }
        />
      )}
      {activeSheet === 'coaching' && (
        <VoiceSettingsSheet
          title="AI Coaching Style"
          options={coachingStyles}
          selected={pageSettings.coachingStyle}
          onSelect={(v) => {
            updateSetting('coachingStyle', v);
            setActiveSheet(null);
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
      {activeSheet === 'voiceModel' && (
        <VoiceSettingsSheet
          title="Voice Model"
          options={voiceModels}
          selected={pageSettings.voiceModel}
          onSelect={(v) => {
            updateSetting('voiceModel', v);
            setActiveSheet(null);
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
      {activeSheet === 'language' && (
        <VoiceSettingsSheet
          title="Voice-to-Text Language"
          options={languages}
          selected={pageSettings.language}
          onSelect={(v) => {
            updateSetting('language', v);
            setActiveSheet(null);
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
      {activeSheet === 'morningTime' && (
        <VoiceSettingsSheet
          title="Morning Check-In Time"
          options={timeOptions}
          selected={pageSettings.morningTime}
          onSelect={(v) => {
            updateSetting('morningTime', v);
            setActiveSheet(null);
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
      {activeSheet === 'nightTime' && (
        <VoiceSettingsSheet
          title="Night Check-In Time"
          options={timeOptions}
          selected={pageSettings.nightTime}
          onSelect={(v) => {
            updateSetting('nightTime', v);
            setActiveSheet(null);
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
    </div>
  );
}
