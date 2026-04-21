import posthog from 'posthog-js';

/**
 * Analytics wrapper — PostHog SDK.
 *
 * Keeps the public API the project already uses (initAnalytics /
 * identify / resetIdentity / track / trackPageView) so existing call
 * sites don't need to change. Event-name migration to the canonical
 * PostHog taxonomy lands in a follow-up MR.
 *
 * Env vars (set on Vercel):
 *   VITE_POSTHOG_KEY  — Project API key from PostHog dashboard
 *   VITE_POSTHOG_HOST — Ingest host, typically https://us.i.posthog.com
 *                       (or https://eu.i.posthog.com)
 */

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com';

let initialized = false;

export function initAnalytics(): void {
  if (!KEY || initialized) return;

  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: false, // we handle this manually via usePageTracking
    persistence: 'localStorage',
    // Session replay — mask everything sensitive by default (PostHog doc §8.1)
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '.sensitive',
    },
    // Capacitor's native HTTP plugin mishandles gzip bodies on Android,
    // causing the ingest server to reject with 400 "invalid GZIP data".
    disable_compression: true,
  });
  initialized = true;
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.identify(userId, traits);
}

/** Alias — some call sites use setUserProperty per PostHog doc §2.1. */
export function setUserProperty(traits: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.people.set(traits);
}

export function resetIdentity(): void {
  if (!initialized) return;
  posthog.reset();
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function trackPageView(path: string): void {
  track('$pageview', { path });
}
