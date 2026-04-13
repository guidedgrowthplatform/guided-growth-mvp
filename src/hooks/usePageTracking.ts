import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/analytics';
import { stopTTS } from '@/lib/services/tts-service';

export function usePageTracking() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Stop any playing voice on page navigation to prevent double audio
    stopTTS();
    trackPageView(pathname);
  }, [pathname]);
}
