/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATE3_ENABLED?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_QA_PASSWORD?: string;
  readonly VITE_COACH_COMPONENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
