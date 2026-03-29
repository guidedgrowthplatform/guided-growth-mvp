import { Icon } from '@iconify/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '@/api/auth';
import { deleteAccount } from '@/api/onboarding';
import { ConfirmDialog } from '@/components/settings/ConfirmDialog';
import {
  coachingStyles,
  formatTime12h,
  languages,
  modeLabels,
  recordingOptions,
  sttLabels,
  sttOptions,
  timeOptions,
  voiceModels,
} from '@/components/settings/constants';
import { SettingRow } from '@/components/settings/SettingRow';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingSectionHeader } from '@/components/settings/SettingSectionHeader';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { TimeBadge } from '@/components/settings/TimeBadge';
import { UserInfoSection } from '@/components/settings/UserInfoSection';
import { VoiceSettingsSheet } from '@/components/settings/VoiceSettingsSheet';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import { useUserPreferences } from '@/hooks/useUserPreferences';
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

type SheetType =
  | 'stt'
  | 'recording'
  | 'ttsVoice'
  | 'coaching'
  | 'voiceModel'
  | 'language'
  | 'morningTime'
  | 'nightTime';

export function SettingsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user, signOut } = useAuth();
  const { preferences: pageSettings, updatePreference } = useUserPreferences();
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
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const exportAbortRef = useRef(false);

  const handleExportData = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    exportAbortRef.current = false;
    try {
      const { exportUserDataCSV } = await import('@/lib/utils/export-csv');
      await exportUserDataCSV();
      if (!exportAbortRef.current) {
        addToast('success', 'Data exported successfully!');
      }
    } catch (err) {
      if (!exportAbortRef.current) {
        const msg = err instanceof Error ? err.message : 'Export failed';
        addToast('error', `Export failed: ${msg}`);
      }
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, addToast]);

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
    setIsDeletingAccount(true);
    try {
      await deleteAccount();
      localStorage.clear();
      await signOut();
      navigate('/sign-in');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete account';
      addToast('error', msg);
      setIsDeletingAccount(false);
    }
  }, [signOut, addToast, navigate]);

  // Lookup labels
  const coachingLabel =
    coachingStyles.find((s) => s.value === pageSettings.coachingStyle)?.label ??
    'Friendly & Empathetic';
  const voiceModelLabel =
    voiceModels.find((m) => m.value === pageSettings.voiceModel)?.label ?? 'Alex (Male - Calm)';
  const languageLabel =
    languages.find((l) => l.value === pageSettings.language)?.label ?? 'English (US)';

  const fullName = user?.name;
  const email = user?.email ?? '';
  const displayName = fullName ?? email.split('@')[0] ?? 'User';

  return (
    <div>
      <SettingsHeader onBack={() => navigate(-1)} />

      <UserInfoSection
        name={displayName}
        email={email}
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
                  updatePreference('pushNotifications', v);
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
            icon="mdi:download"
            label={isExporting ? 'Exporting...' : 'Export My Data'}
            onClick={handleExportData}
            right={
              isExporting ? (
                <Icon
                  icon="svg-spinners:ring-resize"
                  width={20}
                  className="text-content-tertiary"
                />
              ) : (
                <Icon icon="ic:round-chevron-right" width={20} className="text-content-tertiary" />
              )
            }
          />
          <SettingRow icon="ic:round-logout" label="Log Out" onClick={logout} />
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
          isLoading={isDeletingAccount}
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
            updatePreference('coachingStyle', v);
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
            updatePreference('voiceModel', v);
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
            updatePreference('language', v);
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
            updatePreference('morningTime', v);
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
            updatePreference('nightTime', v);
            setActiveSheet(null);
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
    </div>
  );
}
