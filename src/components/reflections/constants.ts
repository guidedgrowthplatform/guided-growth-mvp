export interface MoodPreset {
  key: string;
  emoji: string;
  label: string;
}

export const MOOD_PRESETS: readonly MoodPreset[] = [
  { key: 'awesome', emoji: '✨', label: 'Awesome' },
  { key: 'energized', emoji: '💪', label: 'Energized' },
  { key: 'calm', emoji: '🌿', label: 'Calm' },
  { key: 'peaceful', emoji: '🧘', label: 'Peaceful' },
  { key: 'meh', emoji: '😐', label: 'Meh' },
  { key: 'rough', emoji: '😔', label: 'Rough' },
] as const;

export const MOOD_MAP: Record<string, MoodPreset> = Object.fromEntries(
  MOOD_PRESETS.map((m) => [m.key, m]),
);

export function getMoodPreset(key: string | null | undefined): MoodPreset | null {
  if (!key) return null;
  return MOOD_MAP[key] ?? null;
}
