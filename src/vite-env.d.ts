/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATE3_ENABLED?: string;
  // 'auto' in QA / staging builds turns the AI-turn console trace on for the whole
  // environment with no opt-in. Unset in production (trace compiled off). See
  // src/lib/debug/traceConsole.ts.
  readonly VITE_DEBUG_TRACE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
