import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useVoice } from '@/hooks/useVoice';
import { trackPageView } from '@/lib/analytics';
import { stopTTS } from '@/lib/services/tts-service';

export function usePageTracking() {
  const { pathname } = useLocation();
  const { stopAll } = useVoice();

  useEffect(() => {
    // Stop MP3/TTS on navigation — but NOT realtime (agent manages its own lifecycle)
    stopTTS();
    // Only stopAll (which resets VoiceContext) on non-onboarding pages
    // ONBOARD-01 uses realtime agent that should persist
    if (!pathname.includes('/onboarding')) {
      stopAll();
    }
    trackPageView(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
