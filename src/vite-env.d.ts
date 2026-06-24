/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Soniox streaming STT (voice-in). Required for mic input on Direct-LLM beats.
  readonly VITE_STATE3_ENABLED?: string;
  // Master switch for real Vapi full-duplex on the chat-native onboarding page.
  // Full voice onboarding needs BOTH this AND VITE_STATE3_ENABLED.
  readonly VITE_ONBOARDING_CHAT_VAPI?: string;
  // Dev-only seeded static feed; must be OFF in real builds (gates out LLM/Vapi
  // turns + completion).
  readonly VITE_ONBOARDING_STATIC_FEED?: string;
  readonly VITE_VAPI_DAILY_CAP?: string;
  readonly VITE_VOICE_CAP_DISABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
