/**
 * The designer's source of truth, mirrored.
 *
 * This is a verbatim copy of the `DEFAULT_FLOW` / `ONBOARDING_FLOW` array in the
 * flow builder (`ggmvp-flow-builder/src/components/flow-designer/FlowBuilder.tsx`,
 * around line 410). The unified app cannot import across repos, so the transform
 * reads this mirror. When the designer changes its DEFAULT_FLOW, paste the new
 * array here and re-run the transform (see scripts/flow-sync/README inputs in
 * ../flows/README-flow-sync.md).
 *
 * Only the SHAPE the transform reads is mirrored (type, beat, sheetStage, props,
 * background). The builder's full DefaultBeat type carries no other runtime field.
 */

/** One entry in the designer's DEFAULT_FLOW array (the builder's DefaultBeat). */
export interface DesignerBeat {
  /** The designer component type, e.g. "profile-beat", "path-selection". */
  type: string;
  /** 1-based beat number as authored in the builder (string in the source). */
  beat?: string;
  /** "ONBOARD-01--FORM: Profile Setup" (screenId is the part before the colon). */
  sheetStage?: string;
  /** Static props authored in the builder; coachLine / greeting carry the opener. */
  props?: Record<string, string>;
  /** "coach" or "user": who leads the beat. Not consumed by the engine today. */
  background?: string;
}

/**
 * Mirror of ggmvp-flow-builder DEFAULT_FLOW (the onboarding starter set).
 * Keep this in lockstep with the builder source. Last synced: 2026-06-26.
 *
 * Differences from the builder array, by design:
 *   - The builder's beat-0 `qa-control` launcher is OMITTED here. It is a QA-only
 *     design beat (the engine already ships QAControlScreen.tsx); it is not part
 *     of the engine onboarding flow.
 *   - `showOnPath` / `variant` are not mirrored: the transform derives the fork
 *     lanes from the path-selection beat, and the engine has no QA variant.
 */
export const DESIGNER_ONBOARDING_FLOW: DesignerBeat[] = [
  { type: 'splash', beat: '1', background: 'coach' },
  { type: 'get-started', beat: '2', background: 'coach' },
  { type: 'splash-intro', beat: '3', background: 'coach' },
  { type: 'auth-signup', beat: '4', background: 'user' },
  {
    type: 'mic-permission',
    beat: '5',
    background: 'coach',
    props: {
      heading: 'Allow your microphone',
      sub: 'So you can talk with your coach out loud.',
      allowLabel: 'Allow microphone',
      skipLabel: 'Not now',
    },
  },
  {
    type: 'profile-beat',
    beat: '6',
    background: 'coach',
    sheetStage: 'ONBOARD-01--FORM: Profile Setup',
    props: {
      greeting: 'Awesome {name}, two quick things so I can tailor this to you.',
      askAge: 'How old are you?',
      askGender: "And what's your gender?",
      userReply: "I'm 28, and I'm male.",
      age: '28',
      gender: 'Male',
    },
  },
];
