export type VoiceGender = 'male' | 'female';

// Cartesia sonic-3 IDs. Verified 2026-04-26; rotates silently.
export const CARTESIA_VOICES: Record<VoiceGender, { id: string; name: string }> = {
  male: { id: '5ee9feff-1265-424a-9d7f-8e4d431a12c7', name: 'Ronald' },
  female: { id: 'f786b574-daa5-4673-aa0c-cbe3e8534c02', name: 'Katie' },
};

// Coach Yair cloned voice — post-onboarding coach TTS
export const COACH_VOICE_ID = '0a974815-0e4d-4dfc-b478-37a7b943da70';
