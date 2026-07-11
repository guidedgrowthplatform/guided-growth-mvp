import * as Sentry from '@sentry/react';
import { isReplayDisabled } from './replayGuard';

const DSN = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!DSN) return;

  // QA fleet, TestFlight/APK builds, and browser QA (via ?noreplay=1) skip
  // Replay entirely so they never consume the free plan's 50-replays-per-cycle
  // quota. See replayGuard for the three disable paths.
  const replayDisabled = isReplayDisabled();

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    sendDefaultPii: false,
    integrations: replayDisabled
      ? [Sentry.browserTracingIntegration()]
      : [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: replayDisabled ? 0 : 0.1,
    replaysOnErrorSampleRate: replayDisabled ? 0 : 1.0,
  });
}

export { Sentry };
