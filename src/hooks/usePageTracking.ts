import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useVoice } from '@/hooks/useVoice';
import { trackPageView } from '@/lib/analytics';
import { stopTTS } from '@/lib/services/tts-service';

export function usePageTracking() {
  const { pathname } = useLocation();
  const { stopAll } = useVoice();

  useEffect(() => {
    // Stop ALL audio on page navigation — TTS, MP3, realtime
    stopTTS();
    stopAll();
    trackPageView(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
