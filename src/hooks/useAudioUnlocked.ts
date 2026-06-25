import { useSyncExternalStore } from 'react';
import { isAudioUnlocked, subscribeAudioUnlock } from '@/lib/services/tts-service';

export function useAudioUnlocked(): boolean {
  return useSyncExternalStore(subscribeAudioUnlock, isAudioUnlocked, () => false);
}
