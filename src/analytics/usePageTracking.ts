import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from './posthog';

export function usePageTracking() {
  const { pathname } = useLocation();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);
}
