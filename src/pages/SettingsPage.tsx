import { useState, useEffect } from 'react';
import { useVoiceSettingsStore, type RecordingMode, type SttProvider } from '@/stores/voiceSettingsStore';
import { getAvailableVoices, setVoicePreference, speak, getVoicePreference } from '@/lib/services/tts-service';

export function SettingsPage() {
  const { recordingMode, setRecordingMode, ttsEnabled, setTtsEnabled, sttProvider, setSttProvider } = useVoiceSettingsStore();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>(getVoicePreference() || '');

  // Load voices (Chrome loads them async)
  useEffect(() => {
    const loadVoices = () => {
      const available = getAvailableVoices();
      setVoices(available);
      if (!selectedVoice && available.length > 0) {
        setSelectedVoice(available[0].name);
      }
    };

    loadVoices();

    // Chrome fires voiceschanged event after async load
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoice]);

  const handleVoiceChange = (voiceName: string) => {
    setSelectedVoice(voiceName);
    setVoicePreference(voiceName);
    useVoiceSettingsStore.getState().setSelectedVoiceName(voiceName);
  };

  const handlePreview = () => {
    speak('Hello! I am your growth tracker assistant. How can I help you today?');
  };

  const modes: { value: RecordingMode; label: string; description: string; icon: string }[] = [
    {
      value: 'auto-stop',
      label: 'Auto-stop (Siri-like)',
      description: 'Stops recording after 2.5s of silence. Best for quick voice commands.',
      icon: '⏱️',
    },
    {
      value: 'always-on',
      label: 'Always recording',
      description: 'Keeps microphone active until manually stopped. Good for longer dictation.',
      icon: '🎙️',
    },
  ];

  const sttProviders: { value: SttProvider; label: string; description: string; icon: string }[] = [
    {
      value: 'webspeech',
      label: 'Web Speech API',
      description: 'Browser built-in. Free, real-time interim results. Requires internet.',
      icon: '🌐',
    },
    {
      value: 'whisper',
      label: 'Whisper (whisper.cpp)',
      description: 'OpenAI Whisper base model. Runs locally in browser via WASM. ~75MB download on first use.',
      icon: '🤖',
    },
    {
      value: 'deepgram',
      label: 'DeepGram Nova-2',
      description: 'Cloud-based. Fastest transcription with real-time streaming. Requires API key.',
      icon: '⚡',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Settings</h1>

      {/* STT Provider */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
          🧠 Speech-to-Text Engine
        </h2>
        <div className="space-y-3">
          {sttProviders.map((provider) => (
            <label
              key={provider.value}
              className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                sttProvider === provider.value
                  ? 'border-cyan-400 bg-cyan-50/50 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 bg-white/80'
              }`}
            >
              <input
                type="radio"
                name="sttProvider"
                value={provider.value}
                checked={sttProvider === provider.value}
                onChange={() => setSttProvider(provider.value)}
                className="mt-1 accent-cyan-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{provider.icon}</span>
                  <span className="font-medium text-slate-800">{provider.label}</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{provider.description}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Recording Mode */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
          🎤 Recording Mode
        </h2>
        <div className="space-y-3">
          {modes.map((mode) => (
            <label
              key={mode.value}
              className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                recordingMode === mode.value
                  ? 'border-cyan-400 bg-cyan-50/50 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 bg-white/80'
              }`}
            >
              <input
                type="radio"
                name="recordingMode"
                value={mode.value}
                checked={recordingMode === mode.value}
                onChange={() => setRecordingMode(mode.value)}
                className="mt-1 accent-cyan-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{mode.icon}</span>
                  <span className="font-medium text-slate-800">{mode.label}</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{mode.description}</p>
              </div>
            </label>
          ))}
        </div>
        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
          ⚠️ Note: Apple may restrict "always recording" mode on iOS.
        </p>
      </section>

      {/* Talk Back Voice Toggle */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
          💬 Talk Back Voice
        </h2>
        <div className="bg-white/80 rounded-xl border border-slate-200 p-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-medium text-slate-800">Voice feedback</span>
              <p className="text-sm text-slate-500 mt-0.5">
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
              <div className="w-11 h-6 bg-slate-300 peer-focus:ring-2 peer-focus:ring-cyan-400 rounded-full peer peer-checked:bg-cyan-500 transition-colors" />
              <div className="absolute left-[2px] top-[2px] w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
            </div>
          </label>
        </div>
      </section>

      {/* Voice Selection */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
          🔊 TTS Voice
        </h2>
        <div className="bg-white/80 rounded-xl border border-slate-200 p-4">
          {voices.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Loading voices...</p>
          ) : (
            <div className="space-y-3">
              <select
                id="voice-select"
                value={selectedVoice}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-400 bg-white"
              >
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <button
                onClick={handlePreview}
                className="text-sm bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg"
              >
                🔊 Preview Voice
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Voice Command Examples */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
          🎤 Voice Command Examples
        </h2>
        <div className="bg-white/80 rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500 mb-3">
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
              <div key={cmd} className="bg-cyan-50/50 rounded-lg p-3 border border-cyan-100">
                <p className="text-sm font-medium text-cyan-700">{cmd}</p>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Management */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
          🗄️ Data
        </h2>
        <div className="bg-white/80 rounded-xl border border-slate-200 p-4">
          <button
            onClick={() => {
              if (confirm('Clear all local data? This cannot be undone.')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="text-sm bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"
          >
            🗑️ Clear All Local Data
          </button>
          <p className="text-xs text-slate-400 mt-2">
            Clears all habits, entries, and preferences from this browser.
          </p>
        </div>
      </section>
    </div>
  );
}
