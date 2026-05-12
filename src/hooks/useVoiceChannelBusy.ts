import { useTtsPlaybackStore } from '@/lib/services/tts-service';
import { useVoiceStore } from '@/stores/voiceStore';
import { useVoice } from './useVoice';

/** Canonical "voice channel in use" signal for UI. */
export function useVoiceChannelBusy(): boolean {
  const isSpeaking = useTtsPlaybackStore((s) => s.isSpeaking);
  const isListening = useVoiceStore((s) => s.isListening);
  const { voiceState } = useVoice();
  return isSpeaking || isListening || voiceState !== 'idle';
}
