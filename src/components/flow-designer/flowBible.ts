// Type-only schema for the rich per-beat contract. Per-beat values live only in
// beatsSource.ts; this file intentionally has no runtime exports or literals.

export type SourceStatus = 'verified' | 'copy-pending' | 'app-reconcile-pending' | 'needs-yair';

export type ScriptVoice = 'verbatim' | 'mp3' | 'cartesia' | null;
export type BindKind = 'bubble' | 'component';

export interface ScriptLine {
  readonly seq: number;
  readonly words: string;
  readonly bindsTo: { readonly kind: BindKind; readonly element: string; readonly screen: string };
  readonly voice: ScriptVoice;
  readonly clip: string | null;
  readonly clipPath: string | null;
  readonly expectedUser?: string;
  readonly interruptible?: boolean;
  /** Say EXACTLY these words via LIVE TTS. Per Yair's ruling, verbatim lines must not use pre-rendered MP3 so the coach can still improvise around them. */
  readonly verbatim?: boolean;
}

export interface TurnBranch {
  readonly on: string;
  readonly reply: string;
  readonly then: string;
  readonly voice?: string;
}

export interface BeatConversation {
  readonly opens: string;
  readonly branches: readonly TurnBranch[];
  readonly maxTurns: number;
  readonly onMaxTurns: string;
  /** RESERVED for the PipeCat integration. */
  readonly responseTimeMs?: number;
  /** RESERVED for the PipeCat integration. */
  readonly endpointPatienceMs?: number;
  /** RESERVED for the PipeCat integration. */
  readonly bargeInPolicy?: 'never' | 'after-first-sentence' | 'always';
  readonly turnDetection?: 'smart' | 'timer';
  /** Lib default: 0.50. Production runs: 0.45. Higher values make the system more patient. */
  readonly smartTurnCompletionThreshold?: number;
  readonly maxSilenceBeforeRepromptMs?: number;
  readonly maxTurnLengthMs?: number;
  readonly sttLanguageHints?: string[];
  /** Pronunciation-lexicon hook for names the pipeline mangles. */
  readonly sttVocabulary?: string[];
  /** Rare override; the global default is the coach voice. */
  readonly ttsVoiceId?: string;
  /**
   * Intentionally excluded: TTS speed/emotion are disabled in Sonic 3.5 and would be dead knobs.
   * Engine/provider are environment cost choices, not per-beat content. 429 fallback and
   * mp3FallbackClipId remain unmodeled because their behavior has been unverified since 2026-06;
   * specify them only after measurement.
   */
}

export interface BeatDatum {
  readonly key: string;
  readonly from: 'flow-state' | 'query-param' | 'server-hydration' | 'user';
  readonly writtenBy?: string;
  readonly persistsTo?: string;
  readonly note?: string;
}

export interface BeatIO {
  readonly dataIn: readonly BeatDatum[];
  readonly dataOut: readonly BeatDatum[];
}

export interface BeatElementLine {
  readonly elementId: string;
  readonly line: string;
  readonly order: number;
  readonly showsAsBubble: boolean;
}

export interface BibleKV {
  readonly label: string;
  readonly value: string;
  readonly pending?: boolean;
}

export interface BibleAlias {
  readonly surface: string;
  readonly value: string;
}

export interface BibleScriptMeta {
  readonly seq: number;
  readonly reveal: string;
  readonly timing: string;
}

export interface BibleVoiceLine {
  readonly seq: number;
  readonly resolvesTo: string;
  readonly liveAllowed: string;
}

export interface BibleRule {
  readonly id: string;
  readonly rule: string;
  readonly severity: 'must' | 'should';
  readonly enforcedBy: readonly string[];
}

export interface BibleToolSpec {
  readonly tool: string;
  readonly args: string;
  readonly when: string;
  readonly pending?: boolean;
}

export interface BibleEdge {
  readonly edge: string;
  readonly behavior: string;
  readonly voice?: string;
}

export interface BibleAcceptance {
  readonly criterion: string;
  readonly check: string;
}

export interface BibleDecision {
  readonly decision: string;
  readonly binds: boolean;
  readonly how: string;
}

export type BibleSectionKey =
  | 'identity'
  | 'scriptMeta'
  | 'components'
  | 'voice'
  | 'rulesContext'
  | 'rulesCode'
  | 'conversation'
  | 'contextProse'
  | 'allowedTools'
  | 'persistence'
  | 'flow'
  | 'edges'
  | 'acceptance'
  | 'applicableDecisions';

export type SectionFillStatus = 'filled' | 'derived' | { readonly na: string };

export interface BibleSections {
  readonly identity?: {
    readonly rows: readonly BibleKV[];
    readonly aliases: readonly BibleAlias[];
    readonly watchOut?: string;
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly scriptMeta?: {
    readonly rows: readonly BibleScriptMeta[];
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly components?: {
    readonly rows: readonly BibleKV[];
    readonly watchOut?: string;
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly voice?: {
    readonly rows: readonly BibleKV[];
    readonly perLine: readonly BibleVoiceLine[];
    readonly assertion?: string;
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly rulesContext?: readonly BibleRule[];
  readonly rulesCode?: readonly BibleRule[];
  readonly conversation?: BeatConversation;
  readonly contextProse?: {
    readonly prose: string;
    readonly pending?: boolean;
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly allowedTools?: {
    readonly tools: readonly string[];
    readonly callRules: string;
    readonly specs: readonly BibleToolSpec[];
    readonly note?: string;
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly persistence?: {
    readonly rows: readonly BibleKV[];
    readonly watchOut?: string;
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly flow?: {
    readonly rows: readonly BibleKV[];
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly edges?: {
    readonly rows: readonly BibleEdge[];
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly acceptance?: {
    readonly rows: readonly BibleAcceptance[];
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly applicableDecisions?: {
    readonly rows: readonly BibleDecision[];
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly sectionManifest: Readonly<Record<BibleSectionKey, SectionFillStatus>>;
}
