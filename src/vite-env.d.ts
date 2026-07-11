/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATE3_ENABLED?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_DISABLE_REPLAY?: string;
  readonly VITE_QA_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
