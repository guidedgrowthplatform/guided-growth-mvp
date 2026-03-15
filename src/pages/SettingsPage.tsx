import { useState, useEffect } from 'react';
import { useVoiceSettingsStore, type RecordingMode, type SttProvider } from '@/stores/voiceSettingsStore';
import { getAvailableVoices, setVoicePreference, speak, getVoicePreference } from '@/lib/services/tts-service';
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
  const { recordingMode, setRecordingMode, ttsEnabled, setTtsEnabled, sttProvider, setSttProvider } = useVoiceSettingsStore();
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

    return () => { if (timer) clearTimeout(timer); };
  }, [selectedVoice]);

  const handleVoiceChange = (voiceName: string) => {
    setSelectedVoice(voiceName);
    setVoicePreference(voiceName);
    useVoiceSettingsStore.getState().setSelectedVoiceName(voiceName);
  };

  const handlePreview = () => {
    speak('Hello! I am your growth tracker assistant. How can I help you today?');
  };

  const modes: { value: RecordingMode; label: string; description: string; icon: React.ReactNode }[] = [
    {
      value: 'auto-stop',
      label: 'Auto-stop (Siri-like)',
      description: 'Stops recording after 2.5s of silence. Best for quick voice commands.',
      icon: <Timer className="w-5 h-5 text-primary" />,
    },
    {
      value: 'always-on',
      label: 'Always recording',
      description: 'Keeps microphone active until manually stopped. Good for longer dictation.',
      icon: <Radio className="w-5 h-5 text-primary" />,
    },
  ];

  const sttProviders: { value: SttProvider; label: string; description: string; icon: React.ReactNode }[] = [
    {
      value: 'webspeech',
      label: 'Web Speech API',
      description: 'Browser built-in. Free, real-time interim results. Requires internet.',
      icon: <Globe className="w-5 h-5 text-primary" />,
    },
    {
      value: 'whisper',
      label: 'Whisper (whisper.cpp)',
      description: 'OpenAI Whisper base model. Runs locally in browser via WASM. ~75MB download on first use.',
      icon: <Bot className="w-5 h-5 text-primary" />,
    },
    {
      value: 'deepgram',
      label: 'DeepGram Nova-2',
      description: 'Cloud-based. Fastest transcription with real-time streaming. Requires API key.',
      icon: <Zap className="w-5 h-5 text-primary" />,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-content mb-6">Settings</h1>

      {/* STT Provider */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
          <Brain className="w-5 h-5" /> Speech-to-Text Engine
        </h2>
        <div className="space-y-3">
          {sttProviders.map((provider) => (
            <label
              key={provider.value}
              className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                sttProvider === provider.value
                  ? 'border-primary bg-surface-secondary shadow-md'
                  : 'border-border hover:border-content-tertiary bg-surface'
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
                <p className="text-sm text-content-secondary mt-1">{provider.description}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Recording Mode */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
          <Mic className="w-5 h-5" /> Recording Mode
        </h2>
        <div className="space-y-3">
          {modes.map((mode) => (
            <label
              key={mode.value}
              className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                recordingMode === mode.value
                  ? 'border-primary bg-surface-secondary shadow-md'
                  : 'border-border hover:border-content-tertiary bg-surface'
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
                <p className="text-sm text-content-secondary mt-1">{mode.description}</p>
              </div>
            </label>
          ))}
        </div>
        <p className="text-xs text-warning mt-2 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> Note: Apple may restrict "always recording" mode on iOS.
        </p>
      </section>

      {/* Talk Back Voice Toggle */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> Talk Back Voice
        </h2>
        <div className="bg-surface rounded-xl border border-border p-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-medium text-content">Voice feedback</span>
              <p className="text-sm text-content-secondary mt-0.5">
                Read results aloud after each voice command
              </p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={ttsEnabled}
                onChange={(e) => setTtsEnabled(e.target.checked)}
                className="sr-only peer"
                id="tts-toggle"
              />
              <div className="w-11 h-6 bg-content-tertiary peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:bg-primary transition-colors" />
              <div className="absolute left-[2px] top-[2px] w-5 h-5 bg-surface rounded-full shadow transition-transform peer-checked:translate-x-5" />
            </div>
          </label>
        </div>
      </section>

      {/* Voice Selection */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
          <Volume2 className="w-5 h-5" /> TTS Voice
        </h2>
        <div className="bg-surface rounded-xl border border-border p-4">
          {voices.length === 0 ? (
            <p className="text-sm text-content-tertiary italic">
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
                className="w-full text-sm border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
              >
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <button
                onClick={handlePreview}
                className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-all shadow-md hover:shadow-lg flex items-center gap-1.5"
              >
                <Volume2 className="w-4 h-4" /> Preview Voice
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Voice Command Examples */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
          <Mic className="w-5 h-5" /> Voice Command Examples
        </h2>
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-sm text-content-secondary mb-3">
            Tap the microphone button on any page and try saying:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { cmd: '"Add a habit called morning meditation"', desc: 'Create a new habit' },
              { cmd: '"Mark exercise as done"', desc: 'Complete a habit for today' },
              { cmd: '"Add a new metric called mood, scale 1 to 10"', desc: 'Track a custom metric' },
              { cmd: '"Log my mood at 8"', desc: 'Record a metric value' },
              { cmd: '"Show my weekly summary"', desc: 'View progress report' },
              { cmd: '"How am I doing with reading?"', desc: 'Check habit stats' },
              { cmd: '"Delete the workout habit"', desc: 'Remove a habit' },
              { cmd: '"I slept well and feel great today"', desc: 'Journal reflection' },
            ].map(({ cmd, desc }) => (
              <div key={cmd} className="bg-surface-secondary rounded-lg p-3 border border-border">
                <p className="text-sm font-medium text-primary">{cmd}</p>
                <p className="text-xs text-content-tertiary mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Management */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
          <Database className="w-5 h-5" /> Data
        </h2>
        <div className="bg-surface rounded-xl border border-border p-4">
          <button
            onClick={() => {
              if (confirm('Clear all local data? This cannot be undone.')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="text-sm bg-danger/10 text-danger border border-danger/20 px-4 py-2 rounded-lg hover:bg-danger/20 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" /> Clear All Local Data
          </button>
          <p className="text-xs text-content-tertiary mt-2">
            Clears all habits, entries, and preferences from this browser.
          </p>
        </div>
      </section>
    </div>
  );
}
