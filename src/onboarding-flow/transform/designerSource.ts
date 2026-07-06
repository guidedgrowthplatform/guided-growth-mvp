/**
 * The designer beat SHAPE the transform consumes (type contract only, L1-4).
 * The hand-typed DESIGNER_ONBOARDING_FLOW mirror is gone: the builder Export
 * JSONs (flows/designer-source*.json) are the single source of truth, adapted
 * by designerSourceJson.ts and validated loud at parse.
 */

/** Ordered bubble/reveal/close segment authored on a designer beat (STEP-0
 * contract). Mirrors the engine's NarrationSegment 1:1; the transform carries
 * it verbatim. 'close' = spoken after the beat's interaction completes. */
export interface DesignerNarrationSegment {
  kind: 'bubble' | 'reveal' | 'close';
  n: number;
  say?: string;
  clip?: string;
}

export interface DesignerMp3Clip {
  id?: string;
  label: string;
  file: string;
  transcript: string;
  opener?: string;
  elementId?: string;
  /** 'close' = spoken after the beat's interaction (STEP-0 close slot). */
  timing?: 'opener' | 'element' | 'full-beat' | 'close';
}

export interface DesignerBeatMeta {
  voiceEngine?: string;
  voiceMode?: string;
  voiceId?: string;
  mp3Assets?: DesignerMp3Clip[];
  spokenContent?: string;
  path?: string;
  llmActive?: boolean;
  allowedTools?: string;
  feedbackConfig?: string;
  animation?: string;
  orb?: { voiceOn?: boolean; micOn?: boolean; micAsking?: boolean; bloomed?: boolean };
  figmaNode?: string;
  status?: string;
  voiceNotes?: string;
  engine?: {
    nodeId?: string;
    backId?: string;
    persistStep?: string;
    pathField?: boolean;
    captureFields?: string;
    toolName?: string;
    toolAdvancesStep?: boolean;
    toolPersistsFields?: string;
    voiceExpectsInput?: boolean;
    voiceDirectLlmAllowed?: boolean;
    maxSelections?: string;
    optionSource?: string;
  };
}

/** One entry in the designer's DEFAULT_FLOW array (the builder's DefaultBeat). */
export interface DesignerBeat {
  /** The designer component type, e.g. "profile-beat", "path-selection". */
  type: string;
  /** 1-based beat number as authored in the builder (string in the source). */
  beat?: string;
  /** Beat display name from the Export; linear flows use it as the node name. */
  name?: string;
  /** "ONBOARD-01--FORM: Profile Setup" (screenId is the part before the colon). */
  sheetStage?: string;
  /** Coach context block from the Export; linear flows inline it on the node. */
  context?: string;
  /** Static props authored in the builder; text / coachLine / greeting carry the
   * opener; the rest pass through as componentProps on linear flows. */
  props?: Record<string, unknown>;
  /** "coach" or "user": who leads the beat. Not consumed by the engine today. */
  background?: string;
  /**
   * Lane hint from the builder Export: 'new' (beginner lane), 'exp' (advanced
   * lane), or null (shared spine). Carried faithfully from the Export but NOT
   * consumed by the transform, which builds the fork structurally by component
   * type (see designerSourceJson.ts + FORK_LANES). The hand-typed mirror below
   * omits it; it is optional.
   */
  showOnPath?: string | null;
  /** Builder-authored sidecar metadata. Optional during the transition. */
  meta?: DesignerBeatMeta;
  /** Ordered bubble/reveal script (STEP-0); absent = single-opener beat. */
  narration?: DesignerNarrationSegment[];
  /** Authoring variant tag, e.g. 'female' for the women's art switch. The Export
   * already carries variant; from STEP-0 the transform preserves it. */
  variant?: string | null;
  /** Suppress the docked orb on this beat (the component draws its own). */
  hideOrb?: boolean;
  /** The component owns its audio/orb sequence (greeting, mic). */
  componentOwned?: boolean;
}
