// Type-only schema for the rich per-beat contract. Per-beat values live only in
// beatsSource.ts; this file intentionally has no runtime exports or literals.

export type SourceStatus = 'verified' | 'copy-pending' | 'app-reconcile-pending' | 'needs-yair';

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
