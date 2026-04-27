import { Capacitor } from '@capacitor/core';
import posthog, { type CaptureOptions, type EventName, type Properties } from 'posthog-js';

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;

// `ui_host` drives the "View session in PostHog" dashboard links. The
// previous `VITE_POSTHOG_HOST` env var held the *ingest* host
// (`us.i.posthog.com`), which is wrong for dashboard links — default to
// the UI host and only override if explicitly set to a non-ingest value.
const RAW_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;
const UI_HOST =
  RAW_HOST && !/\bi\.posthog\.com\b/.test(RAW_HOST) ? RAW_HOST : 'https://us.posthog.com';

const INGEST_PATH = '/ingest';

// Reverse-proxy via our own Vercel domain (see vercel.json rewrites).
// Direct `us.i.posthog.com` fails on two fronts in prod:
//   1. CapacitorHttp intercepts fetch but not sendBeacon — the resulting
//      mixed-transport retry loop surfaces as "Could not connect to the
//      server" every second (Alejandro's BUG-82 screenshots, 2026-04-25).
//   2. Ad-blockers (uBlock/Brave Shields) drop the host by domain, so
//      web captures get ERR_BLOCKED_BY_CLIENT.
// Proxying via `/ingest` puts PostHog on the same origin as the rest of
// the API, so it inherits the CORS/Capacitor whitelist we already ship.
function resolveApiHost(): string {
  if (Capacitor.isNativePlatform()) {
    const base = import.meta.env.VITE_API_URL as string | undefined;
    if (base) return `${base.replace(/\/$/, '')}${INGEST_PATH}`;
  }
  return INGEST_PATH;
}

let initialized = false;

export function initAnalytics(): void {
  if (!KEY || initialized) return;

  posthog.init(KEY, {
    api_host: resolveApiHost(),
    ui_host: UI_HOST,
    capture_pageview: false, // handled manually via usePageTracking
    persistence: 'localStorage',
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '.sensitive',
    },
    // CapacitorHttp mishandles gzip bodies on Android (400 "invalid GZIP
    // data"). Harmless on web — ingest accepts uncompressed POSTs too.
    disable_compression: true,
    person_profiles: 'always',
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

export function track(event: EventName, properties?: Properties, options?: CaptureOptions): void {
  if (!initialized) return;
  posthog.capture(event, properties, options);
}

export function trackPageView(path: string): void {
  track('$pageview', { path });
}
