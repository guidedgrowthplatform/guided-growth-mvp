/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATE3_ENABLED?: string;
  readonly VITE_IS_QA_SURFACE?: 'true';
  readonly VITE_GIT_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
