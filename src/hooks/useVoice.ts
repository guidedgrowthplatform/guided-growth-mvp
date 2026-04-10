import { useContext } from 'react';
import { VoiceContext } from '@/contexts/voiceContextDef';
import type { VoiceContextValue } from '@/contexts/voiceContextDef';

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return ctx;
}
