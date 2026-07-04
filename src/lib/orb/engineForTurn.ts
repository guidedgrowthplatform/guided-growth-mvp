import type { OrbState } from './orbState';

// Single source of truth for which conversational engine owns a turn, so the
// three live-predicates (Vapi / Direct-LLM / Soniox) are derived from ONE
// decision and can never overlap. This decides INTENT only (orbs + beat +
// surface), while local-capture beats are left idle for their adapter-owned
// capture; transient Vapi health gates (anon_id, cap, fatal, cooldown) are
// applied by the caller when turning intent into `vapiShouldBeLive`.
export type ChatEngine = 'vapi' | 'direct_llm' | 'idle';
export type MicSource = 'vapi' | 'soniox' | 'none';

export interface EngineInputs {
  inOnboarding: boolean;
  onChatPage: boolean;
  // orbStateFrom(voiceOn, micOn) — RAW, never pre-remapped.
  rawOrbState: OrbState;
  // Voice-out half on (preferences.voiceMode === 'voice'). On the chat page this
  // alone marks Vapi intent — independent of whether the mic is granted yet.
  voiceOn: boolean;
  micOn: boolean;
  // Chat-page Vapi gating.
  chatVapiFlag: boolean;
  vapiCapableBeat: boolean;
  isLocalCaptureBeat: boolean;
  // Chat page: the beat's screen_id is registered (not the first-render null).
  beatResolved: boolean;
  // Routed screens: a route-resolved screen_id exists.
  hasScreen: boolean;
}

export interface EngineDecision {
  engine: ChatEngine;
  // Exactly one owner of the mic. 'vapi' = WebRTC track; 'soniox' = browser STT.
  micSource: MicSource;
  // Standalone Cartesia TTS gate. False whenever Vapi owns the turn (Vapi
  // speaks itself). On chat-native Direct-LLM turns it follows the user's
  // voice-out toggle: the published flow has no Vapi-brained beats, so this is
  // the ONLY path that speaks dynamic replies in voice mode (B39: the old
  // hardcoded false left every reply a silent text bubble while openers spoke).
  speakReplies: boolean;
}

const IDLE: EngineDecision = { engine: 'idle', micSource: 'none', speakReplies: false };

export function engineForTurn(i: EngineInputs): EngineDecision {
  if (!i.inOnboarding) return IDLE;
  if (i.isLocalCaptureBeat) return IDLE;

  if (i.onChatPage) {
    // Undecided until the beat resolves — neither engine arms. Closes the mount
    // race where Direct-LLM seeded an opener before Vapi could engage.
    if (!i.beatResolved) return IDLE;
    // Voice on, on a Vapi-covered beat → Vapi OWNS the beat (incl. its opener),
    // even before the mic is granted. The caller gates the actual start on mic
    // permission; until then it's Vapi-pending, NOT Direct-LLM — so Direct-LLM can
    // never write a Vapi beat's opener. This is the "both orbs on → only Vapi" rule:
    // keyed off voiceOn (intent), not rawOrbState==='vapi' (which needs mic already on).
    if (i.chatVapiFlag && i.vapiCapableBeat && i.voiceOn) {
      return { engine: 'vapi', micSource: 'vapi', speakReplies: false };
    }
    // Non-Vapi chat beats → Direct-LLM. Soniox owns the mic iff the mic is on,
    // and replies are SPOKEN iff the voice-out half is on (B39 fix: this branch
    // carries every beat on the published flow, so voice mode must speak
    // dynamic replies here; voice off keeps them text-only).
    return { engine: 'direct_llm', micSource: i.micOn ? 'soniox' : 'none', speakReplies: i.voiceOn };
  }

  // Routed onboarding screens (legacy). Vapi when both orbs on; Direct-LLM
  // otherwise (Soniox in voice_in_only, Cartesia out in voice_out_only).
  if (!i.hasScreen) return IDLE;
  if (i.rawOrbState === 'vapi') {
    return { engine: 'vapi', micSource: 'vapi', speakReplies: false };
  }
  return {
    engine: 'direct_llm',
    micSource: i.rawOrbState === 'voice_in_only' ? 'soniox' : 'none',
    speakReplies: i.rawOrbState === 'voice_out_only',
  };
}
