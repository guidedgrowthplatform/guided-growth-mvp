import mixpanel from 'mixpanel-browser';

const TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN as string | undefined;
let initialized = false;

export function initAnalytics() {
  if (!TOKEN || initialized) return;

  mixpanel.init(TOKEN, {
    track_pageview: false, // we handle this manually via usePageTracking
    persistence: 'localStorage',
  });
  initialized = true;
}

export function identify(userId: string, traits?: Record<string, unknown>) {
  if (!initialized) return;
  mixpanel.identify(userId);
  if (traits) mixpanel.people.set(traits);
}

export function resetIdentity() {
  if (!initialized) return;
  mixpanel.reset();
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  mixpanel.track(event, properties);
}

export function trackPageView(path: string) {
  track('Page Viewed', { path });
}
