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
 * background, meta). Metadata is carried into the generated flow for the runtime
 * engine transition; sparse or absent metadata is normalized by the transform.
 */

export interface DesignerMp3Clip {
  id?: string;
  label: string;
  file: string;
  transcript: string;
  opener?: string;
  elementId?: string;
  timing?: 'opener' | 'element' | 'full-beat';
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
  /** "ONBOARD-01--FORM: Profile Setup" (screenId is the part before the colon). */
  sheetStage?: string;
  /** Static props authored in the builder; coachLine / greeting carry the opener. */
  props?: Record<string, string>;
  /** "coach" or "user": who leads the beat. Not consumed by the engine today. */
  background?: string;
  /** Builder-authored sidecar metadata. Optional during the transition. */
  meta?: DesignerBeatMeta;
}

/**
 * Mirror of ggmvp-flow-builder DEFAULT_FLOW (the onboarding starter set).
 * Keep this in lockstep with the builder source. Last synced: 2026-06-29 (v3).
 *
 * Differences from the builder array, by design:
 *   - The builder's beat-0 `qa-control` launcher is OMITTED here. It is a QA-only
 *     design beat (the engine already ships QAControlScreen.tsx); it is not part
 *     of the engine onboarding flow.
 *   - `showOnPath` / `variant` are not mirrored: the transform derives the fork
 *     lanes from the path-selection beat, and the engine has no QA variant.
 *
 * V3 changes vs the 2026-06-26 mirror:
 *   - `why-intro` (beat 7) inserted before the first check-in.
 *   - `state-check` (beat 8a) the user does their first check-in during onboarding.
 *   - `morning-checkin-setup` (beat 8b) moved before the path fork.
 *   - `reflection-card` (beat 9) also moved before the path fork.
 *   - `path-selection` (beat 10) now follows the check-in setup beats.
 *   - `advanced-frequency` (beat 11f) added after advanced-capture on the advanced lane.
 *   - `plan-cards` / plan-review dropped entirely; `into-app` (beat 12) is the single
 *     convergence point for both paths.
 *   - Five `weekly-projection` beats (13a-13e) appended after into-app.
 */
export const DESIGNER_ONBOARDING_FLOW: DesignerBeat[] = [
  { type: 'splash', beat: '1', background: 'coach' },
  { type: 'get-started', beat: '2', background: 'coach' },
  { type: 'splash-intro', beat: '3', background: 'coach' },
  { type: 'auth-signup', beat: '4', background: 'coach' },
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
    // Profile: age + gender only. No name field. Name captured at sign-up;
    // coach greets the user by name (spoken via Cartesia).
    type: 'profile-beat',
    beat: '6',
    background: 'coach',
    sheetStage: 'ONBOARD-01--FORM: Profile Setup',
    props: {
      greeting: 'Good to meet you, {name}. Two quick things so I can tailor this to you.',
      askAge: 'How old are you?',
      askGender: 'And your gender?',
      userReply: "I'm 28, and I'm male.",
      age: '28',
      gender: 'Male',
    },
  },
  {
    // Why intro: onboarding-only framing beat, shown once. Frames why we check in.
    type: 'why-intro',
    beat: '7',
    background: 'coach',
    sheetStage: 'ONBOARD-WHY-INTRO: Why We Check In',
    props: {
      coachLine:
        "Here's the idea. The first habit isn't a workout or a diet. It's just checking in with yourself. It takes a minute, and it changes everything else. Let's start yours right now.",
    },
  },
  {
    // 8a: The user does their first check-in right now.
    type: 'state-check',
    beat: '8a',
    background: 'coach',
    sheetStage: 'ONBOARD-STATE-CHECK: First State Check',
    props: {
      coachLine:
        "Let's do your first check-in right now. How are you landing in this moment? Mood, energy, sleep, anything on you.",
    },
  },
  {
    // 8b: Set the daily check-in time. Reminder ON by default.
    type: 'morning-checkin-setup',
    beat: '8b',
    background: 'coach',
    sheetStage: 'ONBOARD-MORNING-SETUP: Morning Check-in Time',
    props: { coachLine: "When do you want this each day? I'll nudge you then." },
  },
  {
    // 9: Evening reflection, configured only, NOT performed during onboarding.
    type: 'reflection-card',
    beat: '9',
    background: 'coach',
    sheetStage: 'ONBOARD-BEGINNER-07: Evening Reflection Setup',
    props: {
      coachLine:
        'One more. An evening reflection, a couple of minutes to close the day. How do you want to do it, and when?',
    },
  },
  {
    // 10: Path fork, "tracked habits before?"
    type: 'path-selection',
    beat: '10',
    background: 'coach',
    sheetStage: 'ONBOARD-FORK--FORM: Experience Fork',
    props: { coachLine: 'Have you tracked habits before, or is this new for you?' },
  },
  // 11: Beginner path beats (showOnPath:'new')
  {
    type: 'category-grid',
    beat: '11a',
    background: 'coach',
    sheetStage: 'ONBOARD-BEGINNER-01: Category Selection',
    props: {
      coachLine:
        'What part of your life do you most want to work on right now? Pick the one that pulls you.',
    },
  },
  {
    type: 'goals-list',
    beat: '11b',
    background: 'coach',
    sheetStage: 'ONBOARD-BEGINNER-02: Subcategory Selection',
    props: { coachLine: "Within that, what's the piece you want to start with?" },
  },
  {
    type: 'habit-picker',
    beat: '11c',
    background: 'coach',
    sheetStage: 'ONBOARD-BEGINNER-03: Habit Selection',
    props: {
      coachLine:
        "Pick the habits that feel doable. Not impressive, just doable. One you'll actually keep beats five you won't. Make your own if nothing here fits.",
    },
  },
  {
    type: 'habit-schedule',
    beat: '11d',
    background: 'coach',
    sheetStage: 'ONBOARD-BEGINNER-04: Habit Schedule',
    props: {
      coachLine: "How often, and roughly when, for each one? Add a reminder only if you want a nudge.",
    },
  },
  // 11: Advanced path beats (showOnPath:'exp')
  {
    type: 'advanced-capture',
    beat: '11e',
    background: 'coach',
    sheetStage: 'ONBOARD-ADVANCED: Brain Dump',
    props: {
      coachLine:
        "Read me the habits you already track. Less is more to start, you can always build on it.",
      closeCoachLine:
        "Those are all in, and I marked each as build or break. Tell me if any look wrong. If they're good, we'll set the days next.",
    },
  },
  {
    // Advanced frequency: same cards, now growing day circles per habit.
    type: 'advanced-frequency',
    beat: '11f',
    background: 'coach',
    sheetStage: 'ONBOARD-ADVANCED-FREQUENCY: Habit Days',
    props: {
      coachLine: "Now the days. Tell me how often each one runs and I'll fill them in.",
      confirmCoachLine: 'Your habits are all set, your plan is ready.',
    },
  },
  // 12: Single convergence point for both paths. Full plan confirm.
  {
    type: 'into-app',
    beat: '12',
    background: 'coach',
    sheetStage: 'ONBOARD-COMPLETE: Full Plan Confirm',
    props: {
      coachLine:
        "Here's your plan. Your check-in, your reflection, and the habits you picked. Want to start here, or change anything first?",
    },
  },
  // 13a-13e: Weekly projection, five frames shown in sequence.
  {
    type: 'weekly-projection',
    beat: '13a',
    background: 'coach',
    sheetStage: 'ONBOARD-WEEKLY-PROJECTION-BLANK: Blank Week',
    props: {
      state: 'blank',
      coachLine: 'This is your week. Blank, starting today.',
    },
  },
  {
    type: 'weekly-projection',
    beat: '13b',
    background: 'coach',
    sheetStage: 'ONBOARD-WEEKLY-PROJECTION-FULL: Full Green Week',
    props: {
      state: 'full',
      coachLine: 'Best case, every day green. Every streak going strong. That would be amazing.',
    },
  },
  {
    type: 'weekly-projection',
    beat: '13c',
    background: 'coach',
    sheetStage: 'ONBOARD-WEEKLY-PROJECTION-P78: Mostly Done Week',
    props: {
      state: 'p78',
      coachLine:
        "More likely, you land around here. Mostly green, a few misses, your streaks holding. That's a real win.",
    },
  },
  {
    type: 'weekly-projection',
    beat: '13d',
    background: 'coach',
    sheetStage: 'ONBOARD-WEEKLY-PROJECTION-P36: Rough Week',
    props: {
      state: 'p36',
      coachLine:
        "Some weeks land here. One streak survives, the rest take a hit. Still fine, you're building. We reassess.",
    },
  },
  {
    type: 'weekly-projection',
    beat: '13e',
    background: 'coach',
    sheetStage: 'ONBOARD-WEEKLY-PROJECTION-GAPS: Gap Week',
    props: {
      state: 'gaps',
      coachLine:
        'The one thing we want to avoid is this. The empty days you never reported. Stay consistent, just report it. Even a miss counts, that keeps us going.',
    },
  },
];
