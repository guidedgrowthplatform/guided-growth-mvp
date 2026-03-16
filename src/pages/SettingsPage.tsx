import { useState, useEffect } from 'react';
import {
  useVoiceSettingsStore,
  type RecordingMode,
  type SttProvider,
} from '@/stores/voiceSettingsStore';
import {
  getAvailableVoices,
  setVoicePreference,
  speak,
  getVoicePreference,
} from '@/lib/services/tts-service';
import {
  Brain,
  Mic,
  MessageSquare,
  Volume2,
  Database,
  Trash2,
  Globe,
  Bot,
  Zap,
  Timer,
  Radio,
  AlertTriangle,
  Pencil,
} from 'lucide-react';

// Keep Pencil export available for other files that may need it
void Pencil;

export function SettingsPage() {
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

  // Load voices — retry with polling for Android (voiceschanged may not fire)
  useEffect(() => {
    let retries = 0;
    const maxRetries = 12; // 12 x 250ms = 3 seconds
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loadVoices = () => {
      const available = getAvailableVoices();
      if (available.length > 0) {
        setVoices(available);
        if (!selectedVoice) {
          setSelectedVoice(available[0].name);
        }
        if (timer) clearTimeout(timer);
        return true;
      }
      return false;
    };

    // Try immediately
    if (!loadVoices()) {
      // Poll for voices (Android fix)
      const poll = () => {
        retries++;
        if (loadVoices() || retries >= maxRetries) {
          // If still empty after timeout, set empty to show "No voices" message
          if (retries >= maxRetries && voices.length === 0) {
            setVoices([]);
          }
          return;
        }
        timer = setTimeout(poll, 250);
      };
      timer = setTimeout(poll, 250);
    }

    // Chrome fires voiceschanged event after async load
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [selectedVoice]);

  const handleVoiceChange = (voiceName: string) => {
    setSelectedVoice(voiceName);
    setVoicePreference(voiceName);
    useVoiceSettingsStore.getState().setSelectedVoiceName(voiceName);
  };

  const handlePreview = () => {
    speak('Hello! I am your growth tracker assistant. How can I help you today?');
  };

  const modes: {
    value: RecordingMode;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: 'auto-stop',
      label: 'Auto-stop (Siri-like)',
      description: 'Stops recording after 2.5s of silence. Best for quick voice commands.',
      icon: <Timer className="h-5 w-5 text-primary" />,
    },
    {
      value: 'always-on',
      label: 'Always recording',
      description: 'Keeps microphone active until manually stopped. Good for longer dictation.',
      icon: <Radio className="h-5 w-5 text-primary" />,
    },
  ];

  const sttProviders: {
    value: SttProvider;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: 'webspeech',
      label: 'Web Speech API',
      description: 'Browser built-in. Free, real-time interim results. Requires internet.',
      icon: <Globe className="h-5 w-5 text-primary" />,
    },
    {
      value: 'whisper',
      label: 'Whisper (whisper.cpp)',
      description:
        'OpenAI Whisper base model. Runs locally in browser via WASM. ~75MB download on first use.',
      icon: <Bot className="h-5 w-5 text-primary" />,
    },
    {
      value: 'deepgram',
      label: 'DeepGram Nova-2',
      description: 'Cloud-based. Fastest transcription with real-time streaming. Requires API key.',
      icon: <Zap className="h-5 w-5 text-primary" />,
    },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-content">Settings</h1>

      {/* STT Provider */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-content">
          <Brain className="h-5 w-5" /> Speech-to-Text Engine
        </h2>
        <div className="space-y-3">
          {sttProviders.map((provider) => (
            <label
              key={provider.value}
              className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all duration-200 ${
                sttProvider === provider.value
                  ? 'border-primary bg-surface-secondary shadow-md'
                  : 'border-border bg-surface hover:border-content-tertiary'
              }`}
            >
              <input
                type="radio"
                name="sttProvider"
                value={provider.value}
                checked={sttProvider === provider.value}
                onChange={() => setSttProvider(provider.value)}
                className="mt-1 accent-primary"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {provider.icon}
                  <span className="font-medium text-content">{provider.label}</span>
                </div>
                <p className="mt-1 text-sm text-content-secondary">{provider.description}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Recording Mode */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-content">
          <Mic className="h-5 w-5" /> Recording Mode
        </h2>
        <div className="space-y-3">
          {modes.map((mode) => (
            <label
              key={mode.value}
              className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all duration-200 ${
                recordingMode === mode.value
                  ? 'border-primary bg-surface-secondary shadow-md'
                  : 'border-border bg-surface hover:border-content-tertiary'
              }`}
            >
              <input
                type="radio"
                name="recordingMode"
                value={mode.value}
                checked={recordingMode === mode.value}
                onChange={() => setRecordingMode(mode.value)}
                className="mt-1 accent-primary"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {mode.icon}
                  <span className="font-medium text-content">{mode.label}</span>
                </div>
                <p className="mt-1 text-sm text-content-secondary">{mode.description}</p>
              </div>
            </label>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5" /> Note: Apple may restrict "always recording" mode
          on iOS.
        </p>
      </section>

      {/* Talk Back Voice Toggle */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-content">
          <MessageSquare className="h-5 w-5" /> Talk Back Voice
        </h2>
        <div className="rounded-xl border border-border bg-surface p-4">
          <label className="flex cursor-pointer items-center justify-between">
            <div>
              <span className="font-medium text-content">Voice feedback</span>
              <p className="mt-0.5 text-sm text-content-secondary">
                Read results aloud after each voice command
              </p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={ttsEnabled}
                onChange={(e) => setTtsEnabled(e.target.checked)}
                className="peer sr-only"
                id="tts-toggle"
              />
              <div className="peer h-6 w-11 rounded-full bg-content-tertiary transition-colors peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary" />
              <div className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-5" />
            </div>
          </label>
        </div>
      </section>

      {/* Voice Selection */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-content">
          <Volume2 className="h-5 w-5" /> TTS Voice
        </h2>
        <div className="rounded-xl border border-border bg-surface p-4">
          {voices.length === 0 ? (
            <p className="text-sm italic text-content-tertiary">
              {!('speechSynthesis' in window)
                ? 'Text-to-speech is not supported in this browser.'
                : 'No voice options found — TTS will use the device default voice.'}
            </p>
          ) : (
            <div className="space-y-3">
              <select
                id="voice-select"
                value={selectedVoice}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <button
                onClick={handlePreview}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-white shadow-md transition-all hover:bg-primary-dark hover:shadow-lg"
              >
                <Volume2 className="h-4 w-4" /> Preview Voice
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Voice Command Examples */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-content">
          <Mic className="h-5 w-5" /> Voice Command Examples
        </h2>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm text-content-secondary">
            Tap the microphone button on any page and try saying:
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { cmd: '"Add a habit called morning meditation"', desc: 'Create a new habit' },
              { cmd: '"Mark exercise as done"', desc: 'Complete a habit for today' },
              {
                cmd: '"Add a new metric called mood, scale 1 to 10"',
                desc: 'Track a custom metric',
              },
              { cmd: '"Log my mood at 8"', desc: 'Record a metric value' },
              { cmd: '"Show my weekly summary"', desc: 'View progress report' },
              { cmd: '"How am I doing with reading?"', desc: 'Check habit stats' },
              { cmd: '"Delete the workout habit"', desc: 'Remove a habit' },
              { cmd: '"I slept well and feel great today"', desc: 'Journal reflection' },
            ].map(({ cmd, desc }) => (
              <div key={cmd} className="rounded-lg border border-border bg-surface-secondary p-3">
                <p className="text-sm font-medium text-primary">{cmd}</p>
                <p className="mt-0.5 text-xs text-content-tertiary">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Management */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-content">
          <Database className="h-5 w-5" /> Data
        </h2>
        <div className="rounded-xl border border-border bg-surface p-4">
          <button
            onClick={() => {
              if (confirm('Clear all local data? This cannot be undone.')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="flex items-center gap-1.5 rounded-lg border border-danger/20 bg-danger/10 px-4 py-2 text-sm text-danger transition-colors hover:bg-danger/20"
          >
            <Trash2 className="h-4 w-4" /> Clear All Local Data
          </button>
          <p className="mt-2 text-xs text-content-tertiary">
            Clears all habits, entries, and preferences from this browser.
          </p>
        </div>
      </section>
    </div>
  );
}
