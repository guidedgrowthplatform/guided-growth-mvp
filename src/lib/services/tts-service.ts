// Centralized TTS service with pleasant voice selection + pre-acknowledgment
// Replaces the inline speak() in VoiceTranscript.tsx
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

const VOICE_PREF_KEY = 'mvp03_tts_voice';

// Preferred voices ranked by quality (natural-sounding, pleasant)
const PREFERRED_VOICES = [
  'Google UK English Female',
  'Google US English',
  'Microsoft Zira',
  'Samantha',            // macOS
  'Karen',               // macOS Australian
  'Daniel',              // macOS British
  'Google UK English Male',
  'Microsoft David',
];

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;
let ttsUnlocked = false;

function getVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}

/** Find the best available voice, preferring natural-sounding English voices */
function findBestVoice(): SpeechSynthesisVoice | null {
  const voices = getVoices();
  if (voices.length === 0) return null;

  // Check saved preference first
  const savedName = localStorage.getItem(VOICE_PREF_KEY);
  if (savedName) {
    const saved = voices.find((v) => v.name === savedName);
    if (saved) return saved;
  }

  // Try preferred voices in order
  for (const name of PREFERRED_VOICES) {
    const match = voices.find((v) => v.name === name);
    if (match) return match;
  }

  // Fallback: any English voice
  const english = voices.find((v) => v.lang.startsWith('en'));
  return english || voices[0] || null;
}

/** Get the currently selected voice (with lazy initialization) */
export function getSelectedVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice && voicesLoaded) return cachedVoice;
  cachedVoice = findBestVoice();
  voicesLoaded = getVoices().length > 0;
  return cachedVoice;
}

/** Save a specific voice preference */
export function setVoicePreference(voiceName: string): void {
  localStorage.setItem(VOICE_PREF_KEY, voiceName);
  const voices = getVoices();
  cachedVoice = voices.find((v) => v.name === voiceName) || cachedVoice;
}

/** Get the saved voice name */
export function getVoicePreference(): string | null {
  return localStorage.getItem(VOICE_PREF_KEY);
}

/** Get all available voices for the settings UI */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  return getVoices().filter((v) => v.lang.startsWith('en'));
}

/** Strip emoji for cleaner TTS */
function cleanText(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .trim();
}

/**
 * Unlock TTS on iOS — must be called from a user gesture (click/tap handler).
 * iOS Safari blocks speechSynthesis.speak() unless the first call happens
 * inside a user-initiated event. Call this on mic button tap.
 */
export function unlockTTS(): void {
  if (ttsUnlocked || !('speechSynthesis' in window)) return;
  try {
    // FIX #27: iOS Capacitor WebView SSML parser rejects empty/space strings.
    // Use '.' which iOS accepts. Wrap in try-catch so the unlock still
    // registers the user-gesture origin even if the parser throws.
    const utterance = new SpeechSynthesisUtterance('.');
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('[TTS] unlockTTS SSML parse error (safe to ignore):', e);
  }
  ttsUnlocked = true;
}

/** Speak text aloud using the selected pleasant voice */
export function speak(text: string, options?: { rate?: number; pitch?: number; volume?: number }): void {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    // Check if TTS is enabled
    const { ttsEnabled } = useVoiceSettingsStore.getState();
    if (!ttsEnabled) return;
    const clean = cleanText(text);
    if (!clean) return;

    // iOS workaround: cancel any stuck synthesis before speaking
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }

    const utterance = new SpeechSynthesisUtterance(clean);
    const voice = getSelectedVoice();
    if (voice) utterance.voice = voice;

    utterance.rate = options?.rate ?? 1.05;
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.volume = options?.volume ?? 0.85;

    // iOS workaround: Safari pauses synthesis after ~15s.
    // Resume periodically to prevent hanging. Clear on end/error.
    let resumeInterval: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      if (resumeInterval) { clearInterval(resumeInterval); resumeInterval = null; }
    };

    utterance.onend = cleanup;
    utterance.onerror = (e) => {
      console.warn('[TTS] speak error:', e?.error || e);
      cleanup();
    };

    window.speechSynthesis.speak(utterance);

    resumeInterval = setInterval(() => {
      try {
        if (!window.speechSynthesis.speaking) {
          cleanup();
        } else {
          window.speechSynthesis.resume();
        }
      } catch { cleanup(); }
    }, 5000);
  } catch (err) {
    // TTS should NEVER crash the app
    console.warn('[TTS] speak failed (non-critical):', err);
  }
}

/** Pre-acknowledgment messages based on action type */
const PRE_ACK_MESSAGES: Record<string, (params: Record<string, unknown>) => string> = {
  complete: (p) => `OK, marking ${p.name || 'that'} done`,
  create: (p) => `OK, creating ${p.name || 'that'}`,
  delete: (p) => `OK, deleting ${p.name || 'that'}`,
  log: (p) => `OK, logging ${p.name || 'that'}`,
  query: (p) => `OK, let me look up ${p.name || 'your data'}`,
  reflect: () => `OK, saving your reflection`,
  suggest: () => `OK, let me think of a suggestion`,
  update: (p) => `OK, updating ${p.name || 'that'}`,
};

/** Speak a short pre-acknowledgment before the actual action runs */
export function speakPreAck(action: string, params: Record<string, unknown>): void {
  const generator = PRE_ACK_MESSAGES[action];
  if (generator) {
    speak(generator(params), { rate: 1.15, volume: 0.75 });
  }
}

// Load voices when they become available (Chrome loads async)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    voicesLoaded = true;
    cachedVoice = findBestVoice();
  };
  // Trigger initial load
  getVoices();
}
