/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATE3_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
