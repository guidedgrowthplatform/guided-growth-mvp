import { Capacitor } from '@capacitor/core';
import posthog, { type CaptureOptions, type EventName, type Properties } from 'posthog-js';
import { getCurrentInputMethod } from '@/contexts/inputMethodContextDef';

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
  // Read inside the function so vitest's vi.stubEnv() takes effect; reading
  // at module top level would freeze the value at first import.
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key || initialized) return;

  posthog.init(key, {
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

// Pageview is the only event that should never carry input_method — it's
// fired by routing, not user intent. Keep this list narrow so any future
// system event we add has to be added here explicitly.
const EVENTS_WITHOUT_INPUT_METHOD: ReadonlySet<EventName> = new Set(['$pageview']);

export function track(event: EventName, properties?: Properties, options?: CaptureOptions): void {
  if (!initialized) return;

  if (EVENTS_WITHOUT_INPUT_METHOD.has(event)) {
    posthog.capture(event, properties, options);
    return;
  }

  // Auto-attach input_method per PostHog Plan §1.3. Caller-provided
  // values always win — components that already know the input method
  // (e.g. FeedbackSheet's usedVoice flag) keep their explicit choice.
  const enriched: Properties = {
    input_method: getCurrentInputMethod(),
    ...(properties ?? {}),
  };
  posthog.capture(event, enriched, options);
}

export function trackPageView(path: string): void {
  track('$pageview', { path });
}
