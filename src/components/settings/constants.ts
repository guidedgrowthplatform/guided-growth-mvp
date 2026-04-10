import type { RecordingMode, SttProvider } from '@/stores/voiceSettingsStore';

export const sttOptions: { value: SttProvider; label: string; description: string }[] = [
  {
    value: 'cartesia',
    label: 'Cartesia Ink',
    description: 'Cloud-based high-accuracy STT with AI transcript correction.',
  },
];

export const recordingOptions: { value: RecordingMode; label: string; description: string }[] = [
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

export const coachingStyles = [
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

export const voiceModels = [
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

export const languages = [
  { value: 'en-US', label: 'English (US)', description: 'American English speech recognition.' },
  { value: 'en-GB', label: 'English (UK)', description: 'British English speech recognition.' },
  {
    value: 'es-ES',
    label: 'Spanish (Spain)',
    description: 'Castilian Spanish speech recognition.',
  },
];

export const sttLabels: Record<string, string> = {
  cartesia: 'Cartesia Ink',
};

export const modeLabels: Record<string, string> = {
  'auto-stop': 'Auto-stop',
  'always-on': 'Always On',
};

export function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

export function generateTimeOptions(): { value: string; label: string; description: string }[] {
  const options: { value: string; label: string; description: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      options.push({ value, label: formatTime12h(value), description: '' });
    }
  }
  return options;
}

export const timeOptions = generateTimeOptions();
