import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry() {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    sendDefaultPii: true,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}

export { Sentry };
