import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN;

// Replay quota is 50 replays per billing cycle on the free plan. QA fleet and
// simulated-user builds set VITE_DISABLE_REPLAY=1 so they never consume it.
const REPLAY_DISABLED = import.meta.env.VITE_DISABLE_REPLAY === '1';

export function initSentry() {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    sendDefaultPii: false,
    integrations: REPLAY_DISABLED
      ? [Sentry.browserTracingIntegration()]
      : [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: REPLAY_DISABLED ? 0 : 0.1,
    replaysOnErrorSampleRate: REPLAY_DISABLED ? 0 : 1.0,
  });
}

export { Sentry };
