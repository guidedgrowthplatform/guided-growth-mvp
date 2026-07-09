// THE ONE SOURCE for the onboarding render. Each beat lives in ONE entry here:
// the left fields (id, name, order, path, type, context, allowedTools,
// expectedResponse, voiceEngine, voiceMode) plus the right field, script[] (the
// ordered lines the engine plays and runs: seq, words, bindsTo, voice, clip).
// Consolidated once from onboardingMetadata.json + screen_contexts.json (context)
// + beatNarration/voiceClips/clipCaptions (script), which are now retired or thin
// re-exports of this file. The annotated render, the center phone, and #play all
// read this single store. Do NOT re-add a second hand-authored metadata store;
// edit this file. (Pass 2 applies the screenId -> beatId rename.)

import type { BeatConversation, SourceStatus } from './flowBible';

export type BeatPath = 'beginner' | 'advanced' | 'both';
export type VoiceEngine = 'MP3' | 'Cartesia' | 'Vapi' | 'Silent';
export type VoiceMode = 'Verbatim' | 'Improvise' | null;
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
}

// Per-beat data passing contract (flowBible DATA_PASSING): dataIn is what this
// beat reads from flow state, dataOut is what it writes forward.
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

// --- Bible sections (the 12-section per-beat contract) ---
// The full-fill schema the annotated render displays as accordion panels. This
// is the reusable foundation for the annotation-scale fill: 6 of these sections
// (rules, persistence, flow, edges, acceptance, applicable-decisions) were ABSENT
// from the beat shape before; the rest (identity aliases, per-line reveal/timing,
// component detail, per-line voice, coach prose, tool arg schemas) formalize what
// was previously only prose. `bible` is optional; only fully-filled beats carry
// it. Enforcer strings are real static-check / eval ids so `check:rules` can
// resolve them. `pending` marks a value that is COPY-PENDING (Yair's final copy).
// Count note: 14 top-level keys = 13 numbered sections (rules split 5/6, conversation = 13) + applicable-decisions.
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
  // Overlays onto the matching script[] line by seq: the two per-line fields the
  // Bible requires that ScriptLine does not carry (reveal gating + timing).
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

// The 14-key uniform section shape (Yair/conductor 2026-07-09, LOCKED): every
// beat with a bible declares ALL of these, no optional-by-omission sections.
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
// na = short reason a section does not apply to this beat's type.
export type SectionFillStatus = 'filled' | 'pending-app-reconcile' | { readonly na: string };

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
  // section 13 - multi-turn conversation model (Yair 2026-07-09: own section, not a section-5 sub-block)
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
  // uniform shape (Yair/conductor 2026-07-09): every beat declares ALL sections; non-applicable = explicit na + reason, never silently absent
  readonly sectionManifest: Readonly<Record<BibleSectionKey, SectionFillStatus>>;
}

export interface BeatEntry {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly path: BeatPath;
  readonly type: string;
  readonly variantOf?: string; // sub-beat: inherits bible/io/structure from the named head beat, overrides only what differs (Yair 2026-07-09)
  readonly screenId: string | null;
  readonly context: string | null;
  readonly allowedTools: string | null;
  readonly expectedResponse: string | null;
  readonly voiceEngine: VoiceEngine;
  readonly voiceMode: VoiceMode;
  readonly hideOrb: boolean;
  readonly props: Record<string, string> | null;
  readonly elements?: readonly string[];
  readonly script: readonly ScriptLine[];
  // beat-to-beat data passing contract (flowBible DATA_PASSING); dataIn from flow state, never DB re-fetch
  readonly io?: BeatIO;
  // The full 12-section fill for this beat, shown as accordion panels in the
  // annotated render. Optional: present only on fully-filled beats.
  readonly bible?: BibleSections;
}

// The coach persona sent every turn, shared by every flow. Sourced from the
// Master Sheet "Beats Context" GLOBAL row (sync-beat-contexts.mjs). One home so
// no flow re-authors the persona.
export const GLOBAL_CONTEXT = `You are the user's coach inside Guided Growth, running the onboarding conversation. It is one continuous chat: you speak, and interactive cards appear as you go. Your job is to get the user set up while making them feel met, not processed.

## The conversation
- It moves in beats. Each beat hands you one thing to collect and how to behave for that moment. Do that one thing. Never do a later beat's work, never skip ahead.
- The moment the current beat's data is captured, move on. Don't ask "ready?" or "shall we continue?" first.
- Carry everything forward. Never re-ask something the user already gave. If they change an earlier answer, accept the correction and keep going.
- If the user answers more than this beat asked ("I'm 34 and I want to sleep better"), take what belongs to this beat now and hold the rest for the beat it belongs to. Don't act on it early.
- Never say the words beat, step, screen, page, card, tool, or system out loud. The user never hears the machinery.

## Paths (you are told which is active, match it)
- Path 1, full voice: the user talks, you talk back. Short lines, natural for speech.
- Path 2, half voice: you speak, the user types or taps. Speak your line, read their answer.
- Path 3, text only: no voice. Short chat lines, the user types or taps.

## How you talk
- Short lines, like a person. One line per beat unless you genuinely need to clarify.
- React to the exact thing they said. No speeches, no lists, no generic praise like "great choice" or "amazing."
- Never tell the user to tap, click, scroll, swipe, or press. If a card is there, they can see it. You keep it moving by talking.
- The opener you are given is a fixed line, and it may be pre-recorded, so it won't contain the user's name. Use their name in your own lines, never assume it's in the opener.
- Warm, direct, a little excited for them. Never make a new user feel behind, never make an experienced one feel tested.
- Match the user's language. If they speak Hebrew or Spanish, continue in it, and switch whenever they do.

## Reading answers
- Each beat gives you the answers it expects and the words people use for them. Map what you hear to one of those, even when it is slang or sloppy. Never invent a value the beat did not list.
- If an answer is unclear or missing, ask one short question to pin it down, then move on. Don't stall, and don't loop the same question more than twice.

## Speak mode
Each beat may carry a SPEAK MODE line. It tells you how much is scripted.
- VERBATIM_OPENER: the opener is your one scripted line. Say it as written, then stop and wait. Don't add to it.
- SILENT_OPTIONS: the beat shows a list of choices on the screen. That list is reference for you to match what the user says to the exact label. It is never something you read out loud.
- GENERATIVE: no script. Phrase it yourself, within the beat's rules.
A beat can combine them (VERBATIM_OPENER + SILENT_OPTIONS). If a beat has no speak mode line, it's generative.

## Component sync
When a beat puts choices on the screen (categories, the things inside a category, habits, reflection styles), the screen shows them. You're not a second screen.
- Don't read the list out loud, not in full, not a few of them, not even one as an example. Your opener already asks the question.
- Ask one short question that points at the choice ("What pulls you?", "Which one fits?"), then stop and wait.
- The option lists in your context are there only so you can match what the user says to the exact label. They're reference, not a script.
- If nothing has appeared for the user yet, don't fill the silence by naming the options. Ask one neutral question like "Is anything coming up for you to pick from?" If they say no, that's a display problem, not a cue to recite the list.

## Brainstorming (when they're not sure)
- Some users know exactly what they want, others don't. When a beat asks them to choose and they're unsure, stuck, or torn between options, offer to think it through together. Ask one short grounding question, weigh it with them, help them land on one. A real back-and-forth, not a lecture, and not life advice. You're helping them decide, not telling them what to do.
- This shines out loud, on the full-voice path. In text, keep it to a question or two.
- The second they know what they want, take it and move on. Never slow a decisive user down, and never push someone who's ready into a debate they didn't ask for.

## Tools (how you save)
- Each beat tells you which tool to call and when. Call it only once that beat's data is actually captured, then move on.
- Only call a tool the current beat allows. If you are reaching for any other tool, you are getting ahead. Stop and stay on this beat.
- Pass the canonical values the beat defines, not the user's raw words.
- Never tell the user you are saving, loading, or calling anything. It just happens.

## If something heavy comes up
- The user may share something hard. If they do, drop the setup. Be human first, name it plainly, and don't rush them back. Return to setup only when it feels right.

## Privacy
- The user is about to share real, sometimes vulnerable things. Protect that. Don't read their email or account details back to them. Don't narrate what the system is doing.`;

export const BEATS_SOURCE: readonly BeatEntry[] = [
  {
    id: 'splash',
    name: 'Splash',
    order: 0,
    path: 'both',
    type: 'splash',
    screenId: null,
    context: null,
    allowedTools: null,
    expectedResponse: null,
    voiceEngine: 'Silent',
    voiceMode: null,
    hideOrb: false,
    props: null,
    script: [],
    io: {
      dataIn: [],
      dataOut: [],
    },
  },
  {
    id: 'get-started',
    name: 'Get started',
    order: 1,
    path: 'both',
    type: 'get-started',
    screenId: null,
    context: null,
    allowedTools: null,
    expectedResponse: null,
    voiceEngine: 'Silent',
    voiceMode: null,
    hideOrb: false,
    props: null,
    script: [],
    io: {
      dataIn: [],
      dataOut: [],
    },
  },
  {
    id: 'coach-greeting',
    name: 'Coach greeting',
    order: 2,
    path: 'both',
    type: 'splash-intro',
    screenId: 'COACH-GREETING',
    context:
      'BEAT: First hello.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe orb blooms and you speak for the first time. One warm line that lands the surprise of a real voice and invites them in. Then the flow moves on.',
    allowedTools: null,
    expectedResponse: 'Auto-advances',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: true,
    props: null,
    script: [
      {
        seq: 1,
        words:
          "Hey, I might have startled you. You're probably not used to an app just talking to you. I'm your AI coach here at your service at Guided Growth, and I'm excited to help you improve things in your life that are important to you. So let's get you in, and we'll get started.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'COACH-GREETING',
        },
        voice: 'mp3',
        clip: 'coach_greeting',
        clipPath: '/voice/coach_greeting.mp3',
      },
    ],
    io: {
      dataIn: [],
      dataOut: [],
    },
  },
  {
    id: 'sign-up',
    name: 'Sign up',
    order: 3,
    path: 'both',
    type: 'auth-signup',
    screenId: 'ONBOARD-AUTH--FORM',
    context:
      'BEAT: Auth.\n\nThe user signs up or logs in by tapping (Apple, Google, or email). This is also where their name is captured. Stay silent. Do not greet, narrate, or call any tool. The flow advances on its own once the user is authenticated.',
    allowedTools: null,
    expectedResponse: 'Taps Apple, Google, or email sign-in',
    voiceEngine: 'Silent',
    voiceMode: null,
    hideOrb: true,
    props: null,
    script: [],
    io: {
      dataIn: [],
      dataOut: [
        {
          key: 'profile.name',
          from: 'user',
          writtenBy: 'auth sign-up',
          persistsTo: 'auth account',
        },
        { key: 'session', from: 'server-hydration', note: 'auth session established here' },
      ],
    },
  },
  {
    id: 'mic-permission',
    name: 'Mic permission',
    order: 4,
    path: 'both',
    type: 'mic-permission',
    screenId: 'MIC-PERMISSION',
    context:
      "BEAT: Mic permission.\n\nSPEAK MODE: VERBATIM_OPENER\n\nAsk for the mic so the user can talk to you. Keep it light, optional, no pressure. If they skip it, they can still type, and that's completely fine.",
    allowedTools: null,
    expectedResponse: 'Taps Allow or Not now',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: true,
    props: {
      heading: 'Allow your microphone',
      sub: 'So you can talk with your coach out loud.',
    },
    script: [
      {
        seq: 1,
        words:
          "I'd love to actually talk with you. If you let me use your mic, you can just speak.",
        bindsTo: {
          kind: 'component',
          element: 'opener-line',
          screen: 'MIC-PERMISSION',
        },
        voice: 'mp3',
        clip: 'mic_permission_1',
        clipPath: '/voice/ob/mic_permission_1.wav',
      },
    ],
    io: {
      dataIn: [],
      dataOut: [{ key: 'device.micGranted', from: 'user', persistsTo: 'none (OS permission)' }],
    },
  },
  {
    // L2: Profile split into two single-engine beats. This greeting beat is
    // Cartesia (live, has {name}); the asks beat that follows is MP3.
    id: 'profile-greeting',
    name: 'Profile greeting',
    order: 5,
    path: 'both',
    type: 'profile-beat',
    screenId: 'ONBOARD-01--FORM',
    context:
      "BEAT: Profile greeting.\n\nSPEAK MODE: VERBATIM_OPENER\n\nYou already know the user's name from sign-in. Greet them by name, warmly, and set up the two quick things you're about to collect (age and gender). This beat is only the greeting, spoken live in their name. The asks come next.",
    allowedTools: null,
    expectedResponse: 'Auto-advances',
    voiceEngine: 'Cartesia',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    script: [
      {
        seq: 1,
        words: 'Good to meet you, {name}. Two quick things so I can tailor this to you.',
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-01--FORM',
        },
        voice: 'cartesia',
        clip: null,
        clipPath: null,
      },
    ],
    io: {
      dataIn: [
        {
          key: 'profile.name',
          from: 'flow-state',
          writtenBy: 'auth sign-up',
          note: 'the one live {name} slot',
        },
      ],
      dataOut: [],
    },
  },
  {
    // L2: the asks beat. MP3, single-engine. Collects age and gender.
    id: 'profile-asks',
    name: 'Profile asks (age + gender)',
    order: 6,
    path: 'both',
    type: 'profile-beat',
    screenId: 'ONBOARD-01--FORM--ASKS',
    context:
      "BEAT: Profile.\n\nSPEAK MODE: VERBATIM_OPENER\n\nCollect two things: their age and their gender. Ask gender plainly, and never let them skip or decline it. Accept voice or taps. If they give one, ask for the other. Both are required before moving on, gender included. Don't ask for anything else.",
    allowedTools: 'submit_profile, advance_step',
    expectedResponse: 'Says or taps age and gender',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    elements: ['age', 'gender'],
    script: [
      {
        seq: 1,
        words: 'How old are you?',
        bindsTo: {
          kind: 'component',
          element: 'age',
          screen: 'ONBOARD-01--FORM--ASKS',
        },
        voice: 'mp3',
        clip: 'onboard_01_form_1',
        clipPath: '/voice/ob/onboard_01_form_1.wav',
      },
      {
        seq: 2,
        words: "What's your gender?",
        bindsTo: {
          kind: 'component',
          element: 'gender',
          screen: 'ONBOARD-01--FORM--ASKS',
        },
        voice: 'mp3',
        clip: 'onboard_01_form_2',
        clipPath: '/voice/ob/onboard_01_form_2.wav',
      },
    ],
    io: {
      dataIn: [],
      dataOut: [
        {
          key: 'profile.age',
          from: 'flow-state',
          writtenBy: 'submit_profile',
          persistsTo: 'onboarding_states.data (verify key at app-reconcile)',
        },
        {
          key: 'profile.gender',
          from: 'flow-state',
          writtenBy: 'submit_profile',
          persistsTo: 'onboarding_states.data (verify key at app-reconcile)',
        },
      ],
    },
  },
  {
    id: 'state-check',
    name: 'State check-in',
    order: 7,
    path: 'both',
    type: 'state-check',
    screenId: 'ONBOARD-STATE-CHECK',
    context:
      "BEAT: Check-in (opener for the whole process, plus the first state check).\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe opener frames the whole coaching process: it is built on a few small pieces we go through together on the way in, it is built light for everyone (never done this, or tracks a lot), and each part gets explained as we reach it. Then this first piece: a quick state check-in, done right now. The four questions at the end (how's your sleep, mood, energy, and your stress) are the sync points, each blooms its card as it is asked, said once. Then the same cards are the check-in the user fills.\n\nDO NOT:\n- Say the four twice. They are asked once, as the four questions at the end.\n- Render a second set of cards. These cards ARE the check-in.\n- Give advice on what they report. One warm line, then move on.",
    allowedTools: 'record_checkin, advance_step',
    expectedResponse: 'Fills sleep, mood, energy, stress on the same cards',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    script: [
      {
        seq: 1,
        words:
          "I'd like to invite you into a coaching process together. And it's built on a few components we'll go through on the way in. It's built light. I believe less is more, especially in the beginning of a process.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-STATE-CHECK',
        },
        voice: 'mp3',
        clip: 'onboard_state_check_1',
        clipPath: '/voice/ob/onboard_state_check_1.wav',
      },
      {
        seq: 2,
        words:
          "Whether you've never done something like this before or you already track a lot, it is built for you. I'll explain each part as we go. This is the first part, a quick state check-in. And I'd like you to do it right now.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-2',
          screen: 'ONBOARD-STATE-CHECK',
        },
        voice: 'mp3',
        clip: 'onboard_state_check_2',
        clipPath: '/voice/ob/onboard_state_check_2.wav',
      },
      {
        seq: 3,
        words: "How's your sleep?",
        bindsTo: {
          kind: 'component',
          element: 'reveal-1',
          screen: 'ONBOARD-STATE-CHECK',
        },
        voice: 'mp3',
        clip: 'state_sleep',
        clipPath: '/voice/ob/state_sleep.wav',
      },
      {
        seq: 4,
        words: "How's your mood?",
        bindsTo: {
          kind: 'component',
          element: 'reveal-2',
          screen: 'ONBOARD-STATE-CHECK',
        },
        voice: 'mp3',
        clip: 'state_mood',
        clipPath: '/voice/ob/state_mood.wav',
      },
      {
        seq: 5,
        words: "How's your energy?",
        bindsTo: {
          kind: 'component',
          element: 'reveal-3',
          screen: 'ONBOARD-STATE-CHECK',
        },
        voice: 'mp3',
        clip: 'state_energy',
        clipPath: '/voice/ob/state_energy.wav',
      },
      {
        seq: 6,
        words: "How's your stress?",
        bindsTo: {
          kind: 'component',
          element: 'reveal-4',
          screen: 'ONBOARD-STATE-CHECK',
        },
        voice: 'mp3',
        clip: 'state_stress',
        clipPath: '/voice/ob/state_stress.wav',
      },
    ],
    io: {
      dataIn: [],
      dataOut: [
        {
          key: 'checkin.state',
          from: 'flow-state',
          writtenBy: 'record_checkin',
          persistsTo: 'app-reconcile-pending',
          note: 'tool binding forked: no beat_contexts entry; record_checkin exists in the API (deep-QA B6)',
        },
      ],
    },
  },
  {
    id: 'checkin',
    name: 'Morning check-in setup',
    order: 8,
    path: 'both',
    type: 'morning-checkin-setup',
    screenId: 'ONBOARD-MORNING-SETUP',
    context:
      "BEAT: Check-in time.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe user just did their first check-in. Now set the daily time for it, reminder ON by default. Quick. The point isn't that it's morning, it's that this is their first habit and it's simple.",
    allowedTools: 'submit_morning_checkin, advance_step',
    expectedResponse: 'Sets a time and days',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    // L5: morning reorder. Bubble 1 sets up the pick, then the picker reveals,
    // then bubble 2 (the shorter consistency nudge, R4) lands after the picker.
    script: [
      {
        seq: 1,
        words:
          "Part of the coaching process is doing this each day. It gives us two things. First, it's a real quick check-in on how your state is, which is valuable, and people don't usually do it enough. And second, over time it lets us see the connection between your behavior and your state. So when would you like to do this each morning? I recommend 15 minutes after you wake up.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-MORNING-SETUP',
        },
        voice: 'mp3',
        clip: 'onboard_morning_setup_1',
        clipPath: '/voice/ob/onboard_morning_setup_1.wav',
      },
      {
        seq: 2,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-1',
          screen: 'ONBOARD-MORNING-SETUP',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 3,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-2',
          screen: 'ONBOARD-MORNING-SETUP',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 4,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-3',
          screen: 'ONBOARD-MORNING-SETUP',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 5,
        words:
          "Every day is great, but weekdays consistently beats every day occasionally. That's what I recommend to start.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-2',
          screen: 'ONBOARD-MORNING-SETUP',
        },
        voice: 'mp3',
        clip: 'onboard_morning_setup_2',
        clipPath: '/voice/ob/onboard_morning_setup_2.wav',
      },
    ],
    io: {
      dataIn: [],
      dataOut: [
        {
          key: 'checkin.config',
          from: 'flow-state',
          writtenBy: 'submit_morning_checkin',
          persistsTo: 'per submit_morning_checkin handler',
        },
      ],
    },
  },
  {
    id: 'reflection',
    name: 'Evening reflection setup',
    order: 9,
    path: 'both',
    type: 'reflection-card',
    screenId: 'ONBOARD-BEGINNER-07',
    context:
      "BEAT: Evening reflection setup.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nSet it up, don't perform it now. The user picks one style and a time, reminder on by default. The three styles are on the screen: suggested template, your template, freeform. Don't read them out. Ask which feels right and let them pick. If they resist, keep it light, it's two minutes a day.\n\nPERSISTS: whatever they pick IS saved as their reflection template, and the daily evening reflection asks based on it, exactly: suggested template -> the three questions (what am I proud of, what do I forgive myself for, what am I grateful for); your template -> their own saved prompts, in order; freeform -> no questions, just talk. If they choose your template, capture their prompts here so the daily reflection can ask them verbatim.\n\nDO NOT:\n- Read the three styles out loud. They're on the screen.\n- Add coaching per style.\n- Make it feel like homework.",
    allowedTools: 'submit_reflection_config, submit_custom_prompts, advance_step',
    expectedResponse: 'Picks a style and time',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    script: [
      {
        seq: 1,
        words:
          'One more. An evening reflection, a couple of minutes to close out your day. Use these three questions.',
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_07_1',
        clipPath: '/voice/ob/onboard_beginner_07_1.wav',
      },
      {
        seq: 2,
        words: 'What am I proud of?',
        bindsTo: {
          kind: 'component',
          element: 'reveal-1',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: 'reflect_proud',
        clipPath: '/voice/ob/reflect_proud.wav',
      },
      {
        seq: 3,
        words: 'What do I forgive myself for?',
        bindsTo: {
          kind: 'component',
          element: 'reveal-2',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: 'reflect_forgive',
        clipPath: '/voice/ob/reflect_forgive.wav',
      },
      {
        seq: 4,
        words: 'What am I grateful for?',
        bindsTo: {
          kind: 'component',
          element: 'reveal-3',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: 'reflect_grateful',
        clipPath: '/voice/ob/reflect_grateful.wav',
      },
      {
        seq: 5,
        words: 'Or make your own, or just talk freely.',
        bindsTo: {
          kind: 'component',
          element: 'reveal-4',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: 'reflect_alt',
        clipPath: '/voice/ob/reflect_alt.wav',
      },
      {
        seq: 6,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-5',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 7,
        words: "I'd recommend doing this before bed, maybe 15 minutes before you wind down.",
        bindsTo: {
          kind: 'component',
          element: 'reveal-6',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: 'reflect_time',
        clipPath: '/voice/ob/reflect_time.wav',
      },
      {
        seq: 8,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-7',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
    ],
    io: {
      dataIn: [],
      dataOut: [
        {
          key: 'reflection.config',
          from: 'flow-state',
          writtenBy: 'submit_reflection_config',
          persistsTo: 'reflection_settings',
        },
        {
          key: 'reflection.customPrompts',
          from: 'flow-state',
          writtenBy: 'submit_custom_prompts',
          persistsTo: 'reflection_settings (verbatim under the 280-char cap)',
        },
      ],
    },
  },
  {
    id: 'fork',
    name: 'Path fork',
    order: 10,
    path: 'both',
    type: 'path-selection',
    screenId: 'ONBOARD-FORK--FORM',
    context:
      'BEAT: Experience fork.\n\nSPEAK MODE: VERBATIM_OPENER + VERBAL_QUESTION\n\nThe framing "For the next part of the process, I\'d like to know:" shows as one coach bubble. Then, as the two path cards appear, the question "Do you already track habits or is this new to you?" is spoken VERBAL ONLY (not a bubble). New, tried and dropped off, or wants guidance, route to beginner. Has a list or a system already, route to advanced. If unclear, ask one short question.\n\nDO NOT:\n- Read the two choices out loud as a list. The cards show them. Ask the question, then wait.\n- Add "both are totally fine" or any filler tail.',
    allowedTools: 'submit_path_choice, ask_clarification, advance_step',
    expectedResponse: 'New, or I already track habits',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    script: [
      {
        seq: 1,
        words: 'One more question before we set up your habits.',
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-FORK--FORM',
        },
        voice: 'mp3',
        clip: 'onboard_fork_form_1',
        clipPath: '/voice/ob/onboard_fork_form_1.wav',
      },
      {
        seq: 2,
        words: 'Do you already track habits or is this new to you?',
        bindsTo: {
          kind: 'component',
          element: 'reveal-1',
          screen: 'ONBOARD-FORK--FORM',
        },
        voice: 'mp3',
        clip: 'fork_question',
        clipPath: '/voice/ob/fork_question.wav',
      },
      {
        seq: 3,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-2',
          screen: 'ONBOARD-FORK--FORM',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
    ],
    io: {
      dataIn: [],
      dataOut: [
        {
          key: 'flow.path',
          from: 'flow-state',
          writtenBy: 'submit_path_choice',
          persistsTo: 'onboarding_states.data',
          note: 'drives the beginner/advanced branch',
        },
      ],
    },
  },
  {
    id: 'category',
    name: 'Category',
    order: 11,
    path: 'beginner',
    type: 'category-grid',
    screenId: 'ONBOARD-BEGINNER-01',
    context:
      'BEAT: Focus area.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nCollect one category. The opener "Let\'s choose one area of your life that you\'d like to improve on. Here are our recommended categories." shows as a coach bubble, then the category tiles appear. When the "Create your own" option appears at the end, "Or you can create your own" is spoken VERBAL ONLY (not a bubble). Ask what they most want to work on, then wait. If they\'re unsure, you can talk it through with them and help them land on one, you stay open here. If they name several, ask which feels most urgent. Keep the response specific to their pick.\n\nDO NOT:\n- Read the categories out loud. They\'re on the screen.\n- Add commentary per category ("sleep is the foundation", and the like).\n- Praise the pick ("great choice", "love that").\n- Allow more than one. If they name two, ask which feels most urgent.\n- Say anything after they pick except calling submit_category and advance_step.',
    allowedTools: 'submit_category, advance_step',
    expectedResponse: 'Names or picks one category',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    script: [
      {
        seq: 1,
        words:
          "Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-BEGINNER-01',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_01_1',
        clipPath: '/voice/ob/onboard_beginner_01_1.wav',
      },
      {
        seq: 2,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-8',
          screen: 'ONBOARD-BEGINNER-01',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 3,
        words: 'Or you can create your own.',
        bindsTo: {
          kind: 'component',
          element: 'reveal-9',
          screen: 'ONBOARD-BEGINNER-01',
        },
        voice: 'mp3',
        clip: 'create_your_own',
        clipPath: '/voice/ob/create_your_own.wav',
      },
    ],
    io: {
      dataIn: [
        {
          key: 'profile.gender',
          from: 'flow-state',
          writtenBy: 'submit_profile',
          note: 'default variant: renders for everyone except Female (decision 3)',
        },
      ],
      dataOut: [
        {
          key: 'onboarding.category',
          from: 'flow-state',
          writtenBy: 'submit_category',
          persistsTo: 'onboarding_states.data (verify key at app-reconcile)',
        },
      ],
    },
  },
  {
    id: 'category-women',
    name: 'Category (women’s art)',
    order: 12,
    path: 'beginner',
    type: 'category-grid',
    variantOf: 'category',
    screenId: 'ONBOARD-BEGINNER-01',
    context:
      'BEAT: Focus area.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nCollect one category. The opener "Let\'s choose one area of your life that you\'d like to improve on. Here are our recommended categories." shows as a coach bubble, then the category tiles appear. When the "Create your own" option appears at the end, "Or you can create your own" is spoken VERBAL ONLY (not a bubble). Ask what they most want to work on, then wait. If they\'re unsure, you can talk it through with them and help them land on one, you stay open here. If they name several, ask which feels most urgent. Keep the response specific to their pick.\n\nDO NOT:\n- Read the categories out loud. They\'re on the screen.\n- Add commentary per category ("sleep is the foundation", and the like).\n- Praise the pick ("great choice", "love that").\n- Allow more than one. If they name two, ask which feels most urgent.\n- Say anything after they pick except calling submit_category and advance_step.',
    allowedTools: 'submit_category, advance_step',
    expectedResponse: 'Names or picks one category',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      variant: 'female',
    },
    bible: {
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'category-women' },
          { label: 'name', value: "Category (women's art)" },
          { label: 'order', value: '12' },
          { label: 'path', value: 'beginner' },
          { label: 'type', value: 'category-grid' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-BEGINNER-01' },
          { surface: 'route', value: '/onboarding/beginner-01 (women-art variant)' },
          { surface: 'persisted current_step', value: 'category-women' },
          { surface: 'session_log value', value: 'category-women' },
          { surface: 'data-beat-id', value: 'category-women' },
        ],
        watchOut:
          'category and category-women SHARE screenId ONBOARD-BEGINNER-01. The beatId is the only unique key, so the render selects the variant by gender (code rule), not by screenId. The alias-check must allow two beatIds on one screenId while keeping each beatId other aliases unique.',
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'opener bubble; no gate',
            timing: 'karaoke per-word on the bubble',
          },
          {
            seq: 2,
            reveal: 'the category tiles bloom, GATED on seq 1 clip end',
            timing: 'n/a (silent reveal)',
          },
          {
            seq: 3,
            reveal:
              'the create-your-own tile blooms, GATED on seq 2 reveal; this clip is VERBAL ONLY (not a bubble)',
            timing: 'karaoke per-word, no bubble',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'category-grid' },
          { label: 'variant', value: "female (from source props.variant: 'female')" },
          {
            label: 'on-screen tiles',
            value:
              '8 category tiles: Sleep better, Move more, Eat better, Feel more energized, Reduce stress, Improve focus, Break bad habits, Get more organized (LOCKED, Yair 2026-07-09), plus a "Create your own" tile',
          },
          { label: 'selection mode', value: 'single-select, no preselection' },
          {
            label: 'exact state',
            value:
              'nothing selected on entry; tiles render with the women-art illustration set; create-your-own tile appears last (reveal-9)',
          },
          {
            label: 'derived (debug, generated never authored)',
            value: "resolved props: { variant: 'female', tileCount: 8, allowsCustom: true }",
          },
        ],
        watchOut:
          'The ONLY structural difference from category is variant: female. The tile labels, count, and single-select behavior are identical.',
        enforcedBy: ['component-registry-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          {
            label: 'mode',
            value: 'Verbatim (reconciled from source Verbatim; enum is Verbatim / Generative)',
          },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_beginner_01_1', liveAllowed: 'NO' },
          { seq: 2, resolvesTo: 'silent reveal (no audio)', liveAllowed: 'n/a' },
          { seq: 3, resolvesTo: 'recorded clip create_your_own', liveAllowed: 'NO' },
        ],
        assertion:
          'No line here carries a live slot like {name}, so EVERY spoken line MUST resolve to a recorded clip id. None may resolve to live Cartesia.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'catw-verbatim-opener',
          rule: 'Speaks the recorded opener and the create-your-own line verbatim, no improvised lead-in',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'catw-no-read-options',
          rule: 'Never reads the category tiles aloud, not in full, not one as an example',
          severity: 'must',
          enforcedBy: ['eval:no-read-options'],
        },
        {
          id: 'catw-silent-after-pick',
          rule: 'Silent after the pick: no praise, no commentary, nothing except submit_category and advance_step',
          severity: 'must',
          enforcedBy: ['eval:silent-after-pick'],
        },
        {
          id: 'catw-no-contrarian',
          rule: 'No reframe that undercuts the pick ("sleep isn\'t really the issue")',
          severity: 'must',
          enforcedBy: ['eval:no-contrarian'],
        },
        {
          id: 'catw-no-platitudes',
          rule: 'No per-category commentary or filler ("sleep is the foundation", "genuinely")',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
        {
          id: 'catw-one-line-wait',
          rule: 'After the opener, asks one short pointer question then waits',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'catw-single-select',
          rule: 'Allows exactly one category; on two, asks which feels most urgent',
          severity: 'must',
          enforcedBy: ['eval:single-select'],
        },
        {
          id: 'catw-stay-open',
          rule: 'If the user is unsure, stays open and helps them land on one, no lecture',
          severity: 'must',
          enforcedBy: ['eval:brainstorm-then-yield'],
        },
      ],
      rulesCode: [
        {
          id: 'catw-tools-only',
          rule: 'Only submit_category and advance_step are callable on this beat',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'catw-advance-on-tool',
          rule: 'advance_step fires only after submit_category captured a valid category',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'catw-women-variant',
          rule: 'This variant renders ONLY when gender == woman; men, non-binary, undisclosed get the default category render',
          severity: 'must',
          enforcedBy: ['component-registry-check'],
        },
        {
          id: 'catw-reveal-gates',
          rule: 'reveal-8 and reveal-9 gate on the prior line clip end, never a fixed timer',
          severity: 'must',
          enforcedBy: ['reveal-timing-check'],
        },
        {
          id: 'catw-audio-ownership',
          rule: 'Every spoken line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'catw-clips-resolve',
          rule: 'onboard_beginner_01_1 and create_your_own resolve to real assets',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'catw-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      // section 13 - multi-turn conversation model (scripted prompts only, Yair 2026-07-09)
      conversation: {
        opens: 'after the opener bubble and the tiles reveal (ask what they most want to work on)',
        branches: [
          {
            on: 'names or taps one valid category',
            reply: 'none (silent after pick); map to the exact label',
            then: 'tool:submit_category',
          },
          {
            on: 'names two or more',
            reply: 'scripted: "Which feels most urgent right now?"',
            then: 'wait',
          },
          {
            on: 'names something off-list',
            reply:
              'scripted: "You can create your own for that. Want to?" (routes to the create-your-own tile)',
            then: 'wait',
          },
          {
            on: 'unsure / cannot decide',
            reply:
              'scripted help-you-decide prompt set (e.g. "What\'s been weighing on you most lately?"); yields the instant they lean toward one',
            then: 'wait',
          },
          {
            on: 'off-topic or world question',
            reply:
              'global rule glob-out-of-scope: one brief acknowledgement, steer back with the category question',
            then: 'wait',
          },
        ],
        maxTurns: 4,
        onMaxTurns: 'plain one-line re-ask of the category question and point to the tap path',
      },
      contextProse: {
        prose:
          'Focus area. Collect one category. The opener shows as a coach bubble, then the category tiles appear (women-art illustration set). When the create-your-own option appears at the end, "Or you can create your own" is spoken verbal only. Ask what they most want to work on, then wait. If they are unsure, you can talk it through with them and help them land on one. If they name several, ask which feels most urgent. Keep the response specific to their pick.',
        pending: true,
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['submit_category', 'advance_step'],
        callRules:
          'Inherited from GLOBAL_CONTEXT, bound here: call once the category is captured; only this beat tools; pass the canonical category value, not the user raw words.',
        specs: [
          {
            tool: 'submit_category',
            args: '{ category: string } where category is one of the 8 LOCKED labels (CANONICAL_ENUMS.categories) OR a custom string from the create-your-own tile',
            when: 'once the user has settled on exactly one category',
          },
          {
            tool: 'advance_step',
            args: '{}',
            when: 'immediately after submit_category returns',
          },
        ],
        note: 'There is NO submit_habits or submit_goals on this beat. Category uses submit_category only (per coach-per-beat tool correction).',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value: 'the chosen category (one value)',
          },
          {
            label: 'never re-ask',
            value:
              'the category, once captured, is carried forward; downstream goal/habit beats read it, never re-prompt',
          },
          {
            label: 'resume key',
            value: 'current_step advanced past category-women proves this beat is done on refresh',
          },
        ],
        watchOut:
          'Exact table + column for the category write is NOT in the render source or the docs read. Flagged for app-reconcile; do not invent a table name. The carry-forward contract (never re-ask category) is from GLOBAL_CONTEXT and is real.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'submit_category fired with a valid single category, then advance_step',
          },
          {
            label: 'upstream branch (into this beat)',
            value:
              'gender == woman selects this women-art variant; all other genders route to the default category beat',
          },
          {
            label: 'downstream branch (out of this beat)',
            value:
              'create-your-own tile -> goal-custom (order 21); any of the 8 canonical categories -> the matching goals-* beat by category (e.g. Sleep better -> goals-sleep, order 13)',
          },
          {
            label: 'gate',
            value:
              'exactly one category; if the user names two, the coach resolves to one before the tool fires (catw-single-select)',
          },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'submit_category errors: stay on the beat, do not narrate the failure, let the user pick again',
          },
          {
            edge: 'off-topic input',
            behavior:
              'acknowledge briefly, steer back with one short pointer question, do not advance',
          },
          {
            edge: 'skip / decline',
            behavior:
              'user will not choose: stay open, help them think it through (catw-stay-open), never force',
          },
          {
            edge: 'empty state',
            behavior:
              'no tiles appeared for the user: ask one neutral question ("Is anything coming up for you to pick from?"), do NOT recite the category list to fill the silence',
          },
          {
            edge: 'names two',
            behavior: 'ask which feels most urgent, then take the one',
          },
          {
            edge: 'names something off-list',
            behavior: 'route to the create-your-own tile / custom category',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders category-grid variant female, 8 tiles + create-your-own, single-select, nothing preselected (diff phone vs components)',
          },
          {
            criterion: 'says the right thing',
            check:
              'opener spoken verbatim, create-your-own verbal-only, no read / praise / contrarian / platitude (rules.context evals)',
          },
          {
            criterion: 'advances correctly',
            check:
              'exactly one category captured via submit_category, then advance_step; two-category attempt resolves to one first (flow gate)',
          },
          {
            criterion: 'survives a refresh',
            check:
              'category persists, beat not re-asked, current_step resumes past category-women (persistence resume key)',
          },
          {
            criterion: 'variant is correct',
            check:
              'gender == woman renders this beat; any other gender renders default category (catw-women-variant)',
          },
        ],
        enforcedBy: [
          'component-registry-check',
          'advance-gate-check',
          'persistence-contract-check',
          'render-link-integrity-check',
          'eval:parity-walk',
          'eval:edge-walk',
        ],
      },
      applicableDecisions: {
        rows: [
          {
            decision:
              "3. Women's art variant (gender == woman is the ONLY selector; men / non-binary / undisclosed get default)",
            binds: true,
            how: 'this beat IS the render side of decision 3; encoded as rules.code catw-women-variant with component-registry-check',
          },
          {
            decision: '1, 2 (profile gates), 4/5 (habit caps), 6, 7 (reflection)',
            binds: false,
            how: 'not this beat',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: 'filled',
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
    },
    script: [
      {
        seq: 1,
        words:
          "Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-BEGINNER-01',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_01_1',
        clipPath: '/voice/ob/onboard_beginner_01_1.wav',
      },
      {
        seq: 2,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-8',
          screen: 'ONBOARD-BEGINNER-01',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 3,
        words: 'Or you can create your own.',
        bindsTo: {
          kind: 'component',
          element: 'reveal-9',
          screen: 'ONBOARD-BEGINNER-01',
        },
        voice: 'mp3',
        clip: 'create_your_own',
        clipPath: '/voice/ob/create_your_own.wav',
      },
    ],
    io: {
      dataIn: [
        {
          key: 'profile.gender',
          from: 'flow-state',
          writtenBy: 'submit_profile',
          note: 'variant selector: Female renders this beat, everyone else gets category (decision 3)',
        },
      ],
      dataOut: [
        {
          key: 'onboarding.category',
          from: 'flow-state',
          writtenBy: 'submit_category',
          persistsTo: 'onboarding_states.data (verify key at app-reconcile)',
        },
      ],
    },
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Sleep better). Named once, one fewer beat than a separate reaction.
    id: 'goals-sleep',
    name: 'Goals (Sleep better)',
    order: 13,
    path: 'beginner',
    type: 'goals-list',
    screenId: 'ONBOARD-BEGINNER-02--SLEEP',
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Sleep better',
    },
    bible: {
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'goals-sleep' },
          { label: 'name', value: 'Goals (Sleep better)' },
          { label: 'order', value: '13' },
          { label: 'path', value: 'beginner' },
          { label: 'type', value: 'goals-list' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-BEGINNER-02--SLEEP' },
          { surface: 'route', value: '/onboarding/beginner-02 (sleep category variant)' },
          { surface: 'persisted current_step', value: 'goals-sleep' },
          { surface: 'session_log value', value: 'goals-sleep' },
          { surface: 'data-beat-id', value: 'goals-sleep' },
        ],
        watchOut:
          'The 8 goals-* beats share the base screen ONBOARD-BEGINNER-02 and differ only by the category suffix (--SLEEP). The beatId is the unique key; the render selects the variant by the category picked upstream, not by a distinct screenId root. The alias-check must keep each goals-* beatId other aliases unique.',
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal:
              'opener bubble; the Goals tiles bloom GATED on this opener (seq-1) clip end, never a fixed timer',
            timing: 'karaoke per-word on the bubble',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'goals-list' },
          {
            label: 'variant',
            value: "category = Sleep better (from source props.category: 'Sleep better')",
          },
          {
            label: 'on-screen tiles',
            value:
              '4 goal tiles for Sleep better: Fall asleep earlier, Wake up earlier, Sleep more consistently, Sleep more deeply (verbatim from GOAL OPTIONS BY CATEGORY), plus a "Create your own" custom-add affordance',
          },
          { label: 'selection mode', value: 'multi-select, 1 to 2 max, nothing preselected' },
          {
            label: 'exact state',
            value:
              'nothing selected on entry; the "Goals" section label renders above the tiles; a running "n of 2 selected" reflects taps; the Continue affordance advances once 1 to 2 goals are picked',
          },
          {
            label: 'derived (debug, generated never authored)',
            value:
              "resolved props: { category: 'Sleep better', tileCount: 4, min: 1, max: 2, allowsCustom: true }",
          },
        ],
        watchOut:
          'The ONLY structural difference across the 8 goals-* beats is the category and its tile set. Sleep better carries exactly these 4 labels; do not add, rename, or reorder them (they are the canonical GOAL OPTIONS BY CATEGORY strings). The "n of 2 selected" counter and Continue affordance in exact-state are ASSERTED SPEC the render component does not implement yet.',
        enforcedBy: ['component-registry-check'],
        status: 'app-reconcile-pending',
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          {
            label: 'mode',
            value: 'Verbatim (reconciled from source Verbatim; enum is Verbatim / Generative)',
          },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_beginner_02_sleep', liveAllowed: 'NO' },
        ],
        assertion:
          'The opener carries no live slot like {name}, so the one spoken line MUST resolve to the recorded clip onboard_beginner_02_sleep. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'gsleep-verbatim-opener',
          rule: 'Speaks the recorded sleep opener verbatim, no improvised lead-in or addition',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'gsleep-no-read-options',
          rule: 'Never reads the goal tiles aloud, not in full, not one as an example',
          severity: 'must',
          enforcedBy: ['eval:no-read-options'],
        },
        {
          id: 'gsleep-react-and-ask',
          rule: 'React warmly and ask for goals in one merged moment, naming the category (sleep) once',
          severity: 'must',
          enforcedBy: ['eval:warm-opener'],
        },
        {
          id: 'gsleep-no-contrarian',
          rule: 'No reframe that undercuts the pick ("sleep isn\'t really the issue")',
          severity: 'must',
          enforcedBy: ['eval:no-contrarian'],
        },
        {
          id: 'gsleep-no-platitudes',
          rule: 'No per-goal commentary or filler ("sleep is the foundation", "genuinely")',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
        {
          id: 'gsleep-silent-after-pick',
          rule: 'Silent after each pick: no praise, no commentary, nothing except submit_goals and advance_step',
          severity: 'must',
          enforcedBy: ['eval:silent-after-pick'],
        },
        {
          id: 'gsleep-one-line-wait',
          rule: 'After the opener, asks one short pointer question then waits',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'gsleep-one-or-two',
          rule: 'Allows one or two goals only; on three, asks which two matter most',
          severity: 'must',
          enforcedBy: ['eval:selection-cap'],
        },
        {
          id: 'gsleep-stay-open',
          rule: 'If the user is unsure, stays open and helps them land, no lecture',
          severity: 'must',
          enforcedBy: ['eval:brainstorm-then-yield'],
        },
      ],
      rulesCode: [
        {
          id: 'gsleep-tools-only',
          rule: 'Only submit_goals and advance_step are callable on this beat',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'gsleep-canonical-values',
          rule: 'submit_goals passes the exact canonical goal labels (never raw words or renamed labels) and includes the COMPLETE 1-2 selection',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'gsleep-advance-on-tool',
          rule: 'advance_step fires only after submit_goals captured 1 to 2 valid goals',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'gsleep-goal-cap',
          rule: 'At most two goals; floor of one goal to advance',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'gsleep-count-sets-branch',
          rule: 'The goal count (1 or 2) is persisted so the downstream habits beat can distribute the 2-habit cap',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'gsleep-reveal-gates',
          rule: 'The Goals tiles reveal gates on the opener clip end, never a fixed timer',
          severity: 'must',
          enforcedBy: ['reveal-timing-check'],
        },
        {
          id: 'gsleep-audio-ownership',
          rule: 'The opener resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'gsleep-clip-resolves',
          rule: 'onboard_beginner_02_sleep resolves to a real asset',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'gsleep-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      // section 13 - multi-turn conversation model (scripted prompts only, Yair 2026-07-09)
      conversation: {
        opens:
          'after the opener question ("Which of these would you like to start with? Pick one or two.")',
        branches: [
          {
            on: 'names or taps one or two valid goals',
            reply: 'none (silent after pick); map to the exact labels',
            then: 'tool:submit_goals',
          },
          {
            on: 'names three or more',
            reply: 'scripted: "Which two matter most right now?"',
            then: 'wait',
          },
          {
            on: 'vague or general ("just sleep in general")',
            reply: 'scripted: "If you had to pick one, what bothers you most?"',
            then: 'wait',
          },
          {
            on: 'unsure / cannot decide',
            reply:
              'scripted help-you-decide prompt set (e.g. "What\'s been weighing on you most lately?"); yields the instant they lean toward one',
            then: 'wait',
          },
          {
            on: 'off-topic or world question',
            reply:
              'global rule glob-out-of-scope: one brief acknowledgement, steer back with the goal question',
            then: 'wait',
          },
        ],
        maxTurns: 4,
        onMaxTurns: 'plain one-line re-ask of the goal question and point to the tap path',
      },
      contextProse: {
        prose:
          'Goals inside the chosen category (Sleep better). The opener reacts warmly to the category and asks for goals in one merged moment, then the Goals tiles appear. Collect one or two goals. Map what the user says to the exact on-screen label; if they speak generally, map to the closest one or ask one short question. One or two, no more. The goal count sets up the downstream habit distribution. Do not read the tiles out loud, do not coach or explain per goal, do not allow more than two.',
        pending: true,
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['submit_goals', 'advance_step'],
        callRules:
          'Inherited from GLOBAL_CONTEXT, bound here: call once one or two goals are captured; only this beat tools; pass the canonical goal labels including the COMPLETE selection, not the user raw words.',
        specs: [
          {
            tool: 'submit_goals',
            args: '{ goals: string[] } - the COMPLETE current selection of 1 or 2 goals, each an exact label from GOAL OPTIONS BY CATEGORY for Sleep better (confirm canonical arg name/shape)',
            when: 'once the user has settled on one or two goals',
            pending: true,
          },
          {
            tool: 'advance_step',
            args: '{}',
            when: 'immediately after submit_goals returns',
          },
        ],
        note: 'No submit_category or habit tools on this beat; goals-list uses submit_goals only. Habits are added on the downstream habits-* beat.',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value:
              'the chosen 1-2 goals + the goal count (1 or 2) that sets up the downstream habit distribution',
          },
          {
            label: 'never re-ask',
            value:
              'the goals and count, once captured, carry forward; the habits beat reads them, never re-prompts',
          },
          {
            label: 'resume key',
            value: 'current_step advanced past goals-sleep proves this beat is done on refresh',
          },
        ],
        watchOut:
          'The exact table + column for the goals write is NOT confirmed in the render source. screen_contexts (Vapi-era) indicates user_onboarding.selected_subcategories[]; treat as an app-side hint, not final. Flagged for app-reconcile; do not invent a table name. The carry-forward contract (never re-ask goals) is from GLOBAL_CONTEXT and is real.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'submit_goals fired with 1 to 2 valid goals, then advance_step',
          },
          {
            label: 'upstream branch (into this beat)',
            value:
              'the category picked upstream (Sleep better) routes to this goals-sleep variant; the other 7 categories route to their matching goals-* beat',
          },
          {
            label: 'downstream branch (out of this beat)',
            value:
              'the goal count sets up the habit distribution: two goals -> the next beat gives one habit per goal; one goal -> the next beat allows one or two habits. Each picked goal routes to its matching habits-* opener (e.g. Fall asleep earlier -> habits-fall-asleep-earlier)',
          },
          {
            label: 'gate',
            value:
              'one or two goals; if the user names three, the coach resolves to two before the tool fires (gsleep-one-or-two)',
          },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'submit_goals errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" and the picked tiles stay selected for the retry. Voice path: one short coach line "That didn\'t go through, let me try again." (Yair-approved tool-failure contract, 2026-07-09.)',
          },
          {
            edge: 'off-topic input',
            behavior:
              'one short acknowledgement, at most one sentence, no new topic and no advice, then re-ask the goal question ("Which of these feels right to start with?"). Do not follow the tangent, do not add commentary, do not advance.',
          },
          {
            edge: 'skip / decline',
            behavior:
              'user will not choose: stay open, help them think it through (gsleep-stay-open), never force a pick',
          },
          {
            edge: 'empty state',
            behavior:
              'no tiles appeared for the user: ask one neutral question ("Is anything coming up for you to pick from?"), do NOT recite the goal list to fill the silence',
          },
          {
            edge: 'names three',
            behavior: 'ask which two matter most, then take those two',
          },
          {
            edge: 'vague / general ("just sleep in general")',
            behavior:
              'map to the closest label or ask one short question to pin it ("If you had to pick one, what bothers you most?"); never invent a label',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders goals-list for Sleep better, 4 tiles + create-your-own, multi-select 1-2, nothing preselected (diff phone vs components)',
          },
          {
            criterion: 'says the right thing',
            check:
              'opener spoken verbatim, category named once, no read / praise / contrarian / platitude (rules.context evals)',
          },
          {
            criterion: 'advances correctly',
            check:
              'one or two goals captured via submit_goals, then advance_step; a three-goal attempt resolves to two first (flow gate)',
          },
          {
            criterion: 'survives a refresh',
            check:
              'goals + count persist, beat not re-asked, current_step resumes past goals-sleep (persistence resume key)',
          },
          {
            criterion: 'routes correctly',
            check:
              'each picked goal routes to its matching habits-* opener; the goal count sets the downstream habit distribution',
          },
        ],
        enforcedBy: [
          'component-registry-check',
          'advance-gate-check',
          'persistence-contract-check',
          'render-link-integrity-check',
          'eval:parity-walk',
          'eval:edge-walk',
        ],
      },
      applicableDecisions: {
        rows: [
          {
            decision:
              '4/5. Habit cap (2 habits total, floor 1, distributable: 2 goals x1 or 1 goal x2)',
            binds: false,
            how: 'not enforced on this beat; the cap is enforced on the downstream habits beat. This goals beat captures the 1-or-2 goal COUNT that decision 4/5 uses to distribute the cap, so it is the input, not the gate.',
          },
          {
            decision: '1, 2 (profile gates), 3 (women-art), 6, 7 (reflection)',
            binds: false,
            how: 'not this beat',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words:
          "Awesome that you started with sleep. When your sleep is solid, almost everything else gets easier, your mood, your patience, your focus. Strong place to begin, and I'm glad you did. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--SLEEP',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_sleep',
        clipPath: '/voice/ob/onboard_beginner_02_sleep.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.category', from: 'flow-state', writtenBy: 'submit_category' }],
      dataOut: [
        {
          key: 'onboarding.goals',
          from: 'flow-state',
          writtenBy: 'submit_goals',
          persistsTo: 'onboarding_states.data (verify key)',
          note: 'goal count = goals.length, DERIVED (drives the habits distribution); not a separate persisted field',
        },
      ],
    },
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Move more). Named once, one fewer beat than a separate reaction.
    id: 'goals-move',
    name: 'Goals (Move more)',
    order: 14,
    path: 'beginner',
    type: 'goals-list',
    variantOf: 'goals-sleep',
    screenId: 'ONBOARD-BEGINNER-02--MOVE',
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Move more',
    },
    script: [
      {
        seq: 1,
        words:
          "Love that you chose this. Movement is one of those things where a little goes a long way, and I think you're going to feel the difference faster than you'd expect. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--MOVE',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_move',
        clipPath: '/voice/ob/onboard_beginner_02_move.wav',
      },
    ],
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Eat better). Named once, one fewer beat than a separate reaction.
    id: 'goals-eat',
    name: 'Goals (Eat better)',
    order: 15,
    path: 'beginner',
    type: 'goals-list',
    variantOf: 'goals-sleep',
    screenId: 'ONBOARD-BEGINNER-02--EAT',
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Eat better',
    },
    script: [
      {
        seq: 1,
        words:
          "I'm happy you went with this one. Food is something you touch every single day, so it's a place where small changes really add up, and I'm excited to help you find yours. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--EAT',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_eat',
        clipPath: '/voice/ob/onboard_beginner_02_eat.wav',
      },
    ],
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Feel more energized). Named once, one fewer beat than a separate reaction.
    id: 'goals-energy',
    name: 'Goals (Feel more energized)',
    order: 16,
    path: 'beginner',
    type: 'goals-list',
    variantOf: 'goals-sleep',
    screenId: 'ONBOARD-BEGINNER-02--ENERGY',
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Feel more energized',
    },
    script: [
      {
        seq: 1,
        words:
          "This is a great one to choose. More energy changes how every part of your day feels, and I'm excited for what that could open up for you. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--ENERGY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_energy',
        clipPath: '/voice/ob/onboard_beginner_02_energy.wav',
      },
    ],
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Reduce stress). Named once, one fewer beat than a separate reaction.
    id: 'goals-stress',
    name: 'Goals (Reduce stress)',
    order: 17,
    path: 'beginner',
    type: 'goals-list',
    variantOf: 'goals-sleep',
    screenId: 'ONBOARD-BEGINNER-02--STRESS',
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Reduce stress',
    },
    script: [
      {
        seq: 1,
        words:
          "I'm really glad you chose this. Giving your stress somewhere to go is one of the kindest things you can do for yourself, and I'd love to help you build that. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--STRESS',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_stress',
        clipPath: '/voice/ob/onboard_beginner_02_stress.wav',
      },
    ],
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Improve focus). Named once, one fewer beat than a separate reaction.
    id: 'goals-focus',
    name: 'Goals (Improve focus)',
    order: 18,
    path: 'beginner',
    type: 'goals-list',
    variantOf: 'goals-sleep',
    screenId: 'ONBOARD-BEGINNER-02--FOCUS',
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Improve focus',
    },
    script: [
      {
        seq: 1,
        words:
          "I'm happy you went with focus. There's a specific kind of good that comes from finishing something without your attention scattering everywhere, and I'd love to help you get more of that. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--FOCUS',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_focus',
        clipPath: '/voice/ob/onboard_beginner_02_focus.wav',
      },
    ],
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Break bad habits). Named once, one fewer beat than a separate reaction.
    id: 'goals-break',
    name: 'Goals (Break bad habits)',
    order: 19,
    path: 'beginner',
    type: 'goals-list',
    variantOf: 'goals-sleep',
    screenId: 'ONBOARD-BEGINNER-02--BREAK',
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Break bad habits',
    },
    script: [
      {
        seq: 1,
        words:
          "Love that you're taking this on. These are the changes that actually free up something in your life, and I think you'll be surprised how good it feels to loosen the grip. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--BREAK',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_break',
        clipPath: '/voice/ob/onboard_beginner_02_break.wav',
      },
    ],
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Get more organized). Named once, one fewer beat than a separate reaction.
    id: 'goals-organize',
    name: 'Goals (Get more organized)',
    order: 20,
    path: 'beginner',
    type: 'goals-list',
    variantOf: 'goals-sleep',
    screenId: 'ONBOARD-BEGINNER-02--ORGANIZE',
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Get more organized',
    },
    script: [
      {
        seq: 1,
        words:
          "I'm happy you picked this. There's something really good about clearing the mental clutter, and I think you're going to feel lighter as we go. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--ORGANIZE',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_organize',
        clipPath: '/voice/ob/onboard_beginner_02_organize.wav',
      },
    ],
  },
  {
    id: 'goal-custom',
    name: 'Create your own goal',
    order: 21,
    path: 'beginner',
    type: 'custom-entry',
    screenId: 'ONBOARD-BEGINNER-02-CUSTOM',
    context: null,
    allowedTools: null,
    expectedResponse: 'Names their own goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      kind: 'goal',
    },
    script: [
      {
        seq: 1,
        words: 'What goal do you want to work toward?',
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02-CUSTOM',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_custom_1',
        clipPath: '/voice/ob/onboard_beginner_02_custom_1.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.category', from: 'flow-state', writtenBy: 'submit_category' }],
      dataOut: [
        {
          key: 'onboarding.goals',
          from: 'flow-state',
          writtenBy: 'submit_goals',
          persistsTo: 'onboarding_states.data (verify key)',
          note: 'save tool unresolved (app-reconcile-pending)',
        },
      ],
    },
  },
  {
    id: 'habits',
    name: 'Habits',
    order: 22,
    path: 'beginner',
    type: 'habit-picker',
    screenId: 'ONBOARD-BEGINNER-03',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words:
          "Pick one or two habits that feel doable. One habit that you actually keep is much better than a list of five that you don't keep. Create your own if nothing here fits.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_1',
        clipPath: '/voice/ob/onboard_beginner_03_1.wav',
      },
      {
        seq: 2,
        words: 'Create your own if nothing here fits.',
        bindsTo: {
          kind: 'component',
          element: 'createOwn',
          screen: 'ONBOARD-BEGINNER-03',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.goals', from: 'flow-state', writtenBy: 'submit_goals' }],
      dataOut: [
        {
          key: 'onboarding.habits',
          from: 'flow-state',
          writtenBy: 'add_habit / remove_habit',
          persistsTo: 'per addHabit handler, cap 2 (decision 4/5)',
        },
      ],
    },
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Fall asleep earlier).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-fall-asleep-earlier',
    name: 'Habits (Fall asleep earlier)',
    order: 23,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--FALL-ASLEEP-EARLIER',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Fall asleep earlier',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To fall asleep earlier, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--FALL-ASLEEP-EARLIER',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_fall_asleep_earlier',
        clipPath: '/voice/ob/onboard_beginner_03_goal_fall_asleep_earlier.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Wake up earlier).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-wake-earlier',
    name: 'Habits (Wake up earlier)',
    order: 24,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--WAKE-EARLIER',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Wake up earlier',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To wake up earlier, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--WAKE-EARLIER',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_wake_earlier',
        clipPath: '/voice/ob/onboard_beginner_03_goal_wake_earlier.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Sleep more consistently).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-sleep-consistently',
    name: 'Habits (Sleep more consistently)',
    order: 25,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--SLEEP-CONSISTENTLY',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Sleep more consistently',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To sleep more consistently, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--SLEEP-CONSISTENTLY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_sleep_consistently',
        clipPath: '/voice/ob/onboard_beginner_03_goal_sleep_consistently.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Sleep more deeply).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-sleep-deeply',
    name: 'Habits (Sleep more deeply)',
    order: 26,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--SLEEP-DEEPLY',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Sleep more deeply',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To sleep more deeply, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--SLEEP-DEEPLY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_sleep_deeply',
        clipPath: '/voice/ob/onboard_beginner_03_goal_sleep_deeply.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Walk more).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-walk-more',
    name: 'Habits (Walk more)',
    order: 27,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--WALK-MORE',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Walk more',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "For walking more, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--WALK-MORE',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_walk_more',
        clipPath: '/voice/ob/onboard_beginner_03_goal_walk_more.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Exercise consistently).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-exercise-consistently',
    name: 'Habits (Exercise consistently)',
    order: 28,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--EXERCISE-CONSISTENTLY',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Exercise consistently',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To exercise more consistently, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--EXERCISE-CONSISTENTLY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_exercise_consistently',
        clipPath: '/voice/ob/onboard_beginner_03_goal_exercise_consistently.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Improve mobility).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-mobility',
    name: 'Habits (Improve mobility)',
    order: 29,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--MOBILITY',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Improve mobility',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "For better mobility, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--MOBILITY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_mobility',
        clipPath: '/voice/ob/onboard_beginner_03_goal_mobility.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Eat more intentionally).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-eat-intentionally',
    name: 'Habits (Eat more intentionally)',
    order: 30,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--EAT-INTENTIONALLY',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Eat more intentionally',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To eat more intentionally, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--EAT-INTENTIONALLY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_eat_intentionally',
        clipPath: '/voice/ob/onboard_beginner_03_goal_eat_intentionally.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Reduce overeating).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-reduce-overeating',
    name: 'Habits (Reduce overeating)',
    order: 31,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--REDUCE-OVEREATING',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Reduce overeating',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To reduce overeating, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--REDUCE-OVEREATING',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_reduce_overeating',
        clipPath: '/voice/ob/onboard_beginner_03_goal_reduce_overeating.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Plan food better).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-plan-food',
    name: 'Habits (Plan food better)',
    order: 32,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--PLAN-FOOD',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Plan food better',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To plan your food better, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--PLAN-FOOD',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_plan_food',
        clipPath: '/voice/ob/onboard_beginner_03_goal_plan_food.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Have more morning energy).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-morning-energy',
    name: 'Habits (Have more morning energy)',
    order: 33,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--MORNING-ENERGY',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Have more morning energy',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "For more morning energy, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--MORNING-ENERGY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_morning_energy',
        clipPath: '/voice/ob/onboard_beginner_03_goal_morning_energy.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Avoid afternoon crashes).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-avoid-crashes',
    name: 'Habits (Avoid afternoon crashes)',
    order: 34,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--AVOID-CRASHES',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Avoid afternoon crashes',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To avoid afternoon crashes, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--AVOID-CRASHES',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_avoid_crashes',
        clipPath: '/voice/ob/onboard_beginner_03_goal_avoid_crashes.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Keep energy more stable).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-stable-energy',
    name: 'Habits (Keep energy more stable)',
    order: 35,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--STABLE-ENERGY',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Keep energy more stable',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To keep your energy more stable, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--STABLE-ENERGY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_stable_energy',
        clipPath: '/voice/ob/onboard_beginner_03_goal_stable_energy.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Feel calmer during the day).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-calmer-day',
    name: 'Habits (Feel calmer during the day)',
    order: 36,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--CALMER-DAY',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Feel calmer during the day',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To feel calmer during the day, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--CALMER-DAY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_calmer_day',
        clipPath: '/voice/ob/onboard_beginner_03_goal_calmer_day.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Reduce evening stress).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-evening-stress',
    name: 'Habits (Reduce evening stress)',
    order: 37,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--EVENING-STRESS',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Reduce evening stress',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To reduce evening stress, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--EVENING-STRESS',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_evening_stress',
        clipPath: '/voice/ob/onboard_beginner_03_goal_evening_stress.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Feel less overwhelmed).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-less-overwhelmed',
    name: 'Habits (Feel less overwhelmed)',
    order: 38,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--LESS-OVERWHELMED',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Feel less overwhelmed',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To feel less overwhelmed, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--LESS-OVERWHELMED',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_less_overwhelmed',
        clipPath: '/voice/ob/onboard_beginner_03_goal_less_overwhelmed.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Start work with less friction).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-start-work',
    name: 'Habits (Start work with less friction)',
    order: 39,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--START-WORK',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Start work with less friction',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To start work with less friction, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--START-WORK',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_start_work',
        clipPath: '/voice/ob/onboard_beginner_03_goal_start_work.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Do deeper work).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-deeper-work',
    name: 'Habits (Do deeper work)',
    order: 40,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--DEEPER-WORK',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Do deeper work',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "For deeper work, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--DEEPER-WORK',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_deeper_work',
        clipPath: '/voice/ob/onboard_beginner_03_goal_deeper_work.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Procrastinate less).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-procrastinate-less',
    name: 'Habits (Procrastinate less)',
    order: 41,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--PROCRASTINATE-LESS',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Procrastinate less',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To procrastinate less, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--PROCRASTINATE-LESS',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_procrastinate_less',
        clipPath: '/voice/ob/onboard_beginner_03_goal_procrastinate_less.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Smoking).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-smoking',
    name: 'Habits (Smoking)',
    order: 42,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--SMOKING',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Smoking',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To cut back on smoking, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--SMOKING',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_smoking',
        clipPath: '/voice/ob/onboard_beginner_03_goal_smoking.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Weed).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-weed',
    name: 'Habits (Weed)',
    order: 43,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--WEED',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Weed',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To cut back on weed, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--WEED',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_weed',
        clipPath: '/voice/ob/onboard_beginner_03_goal_weed.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Alcohol).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-alcohol',
    name: 'Habits (Alcohol)',
    order: 44,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--ALCOHOL',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Alcohol',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To cut back on alcohol, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--ALCOHOL',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_alcohol',
        clipPath: '/voice/ob/onboard_beginner_03_goal_alcohol.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Porn).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-porn',
    name: 'Habits (Porn)',
    order: 45,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--PORN',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Porn',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To cut back on porn, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--PORN',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_porn',
        clipPath: '/voice/ob/onboard_beginner_03_goal_porn.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Phone use).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-phone-use',
    name: 'Habits (Phone use)',
    order: 46,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--PHONE-USE',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Phone use',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To cut back on phone use, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--PHONE-USE',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_phone_use',
        clipPath: '/voice/ob/onboard_beginner_03_goal_phone_use.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Late-night snacking).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-late-snacking',
    name: 'Habits (Late-night snacking)',
    order: 47,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--LATE-SNACKING',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Late-night snacking',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words:
          "To cut back on late-night snacking, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--LATE-SNACKING',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_late_snacking',
        clipPath: '/voice/ob/onboard_beginner_03_goal_late_snacking.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Caffeine).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-caffeine',
    name: 'Habits (Caffeine)',
    order: 48,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--CAFFEINE',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Caffeine',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To cut back on caffeine, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--CAFFEINE',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_caffeine',
        clipPath: '/voice/ob/onboard_beginner_03_goal_caffeine.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Stay on top of tasks).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-stay-on-tasks',
    name: 'Habits (Stay on top of tasks)',
    order: 49,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--STAY-ON-TASKS',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Stay on top of tasks',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To stay on top of your tasks, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--STAY-ON-TASKS',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_stay_on_tasks',
        clipPath: '/voice/ob/onboard_beginner_03_goal_stay_on_tasks.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Keep spaces tidy).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-tidy-spaces',
    name: 'Habits (Keep spaces tidy)',
    order: 50,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--TIDY-SPACES',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Keep spaces tidy',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To keep your spaces tidy, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--TIDY-SPACES',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_tidy_spaces',
        clipPath: '/voice/ob/onboard_beginner_03_goal_tidy_spaces.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Handle life admin better).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-life-admin',
    name: 'Habits (Handle life admin better)',
    order: 51,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--LIFE-ADMIN',
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Handle life admin better',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To handle life admin better, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--LIFE-ADMIN',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_life_admin',
        clipPath: '/voice/ob/onboard_beginner_03_goal_life_admin.wav',
      },
    ],
  },
  {
    id: 'habit-custom',
    name: 'Create your own habit',
    order: 52,
    path: 'beginner',
    type: 'custom-entry',
    screenId: 'ONBOARD-BEGINNER-03-CUSTOM',
    context: null,
    allowedTools: null,
    expectedResponse: 'Names their own habit',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      kind: 'habit',
    },
    script: [
      {
        seq: 1,
        words: 'What habit do you want to build?',
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03-CUSTOM',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_custom_1',
        clipPath: '/voice/ob/onboard_beginner_03_custom_1.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.goals', from: 'flow-state', writtenBy: 'submit_goals' }],
      dataOut: [
        {
          key: 'onboarding.habits',
          from: 'flow-state',
          writtenBy: 'add_habit / remove_habit',
          persistsTo: 'per addHabit handler, cap 2 (decision 4/5)',
          note: 'save tool unresolved (app-reconcile-pending)',
        },
      ],
    },
  },
  {
    id: 'schedule',
    name: 'Habit schedule',
    order: 53,
    path: 'beginner',
    type: 'habit-schedule',
    screenId: 'ONBOARD-BEGINNER-04',
    context:
      'BEAT: Habit schedule.\n\nSPEAK MODE: VERBATIM_OPENER\n\nShows ALL the habits the user just picked, each as its own card with the habit name and its day picker (the frequency). The daily check-in and the evening reflection are NOT here, they are rituals, not habits. For each habit, set which days. Recommend weekdays to start. Days default to the weekday preset by locale. Per-habit reminders are OFF by default, on only if the user asks.\n\nDO NOT:\n- Turn a per-habit reminder on unless they ask.\n- Re-ask a piece they already gave.\n- Include the check-in or the reflection as habits here.',
    allowedTools: 'add_habit, update_habit, advance_step',
    expectedResponse: 'Sets the days per habit',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    script: [
      {
        seq: 1,
        words: "Please set the days that you're going to actually do these habits.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-BEGINNER-04',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_04_1',
        clipPath: '/voice/ob/onboard_beginner_04_1.wav',
      },
      {
        seq: 2,
        words:
          'Not every habit needs to be done every day. Three specific days in the week is great as well. Once a week for specific habits, also great.',
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-2',
          screen: 'ONBOARD-BEGINNER-04',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_04_2',
        clipPath: '/voice/ob/onboard_beginner_04_2.wav',
      },
      {
        seq: 3,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-99',
          screen: 'ONBOARD-BEGINNER-04',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.habits', from: 'flow-state' }],
      dataOut: [
        {
          key: 'onboarding.habits',
          from: 'flow-state',
          writtenBy: 'update_habit / add_habit',
          persistsTo: 'per handler',
          note: 'adds days per habit',
        },
      ],
    },
  },
  {
    id: 'advanced-capture',
    name: 'Advanced capture',
    order: 54,
    path: 'advanced',
    type: 'advanced-capture',
    screenId: 'ONBOARD-ADVANCED',
    context:
      "BEAT: Advanced capture.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe user already has habits. Let them read or type them all, in their own words. Each one forms on screen as a card, and each card is auto marked build or break (avoidance wording reads as break, everything else as build). You do NOT ask build or break per habit. Capture verbatim, don't reorganize as they talk. Less is more, especially at the start, they can build on it later. When they finish, name the build and break read once over the whole set and ask for a single yes. If they flag one as wrong, fix that one. Then the days get set on the next beat.\n\nDO NOT:\n- Ask build or break for each habit. The cards already mark it.\n- Reword or reorganize what they said.\n- Push for more. Less is more.",
    allowedTools: 'submit_brain_dump, advance_step',
    expectedResponse: 'Reads or types their habits',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    script: [
      {
        seq: 1,
        words:
          "Read me the list of the habits that you already track. In the next step we'll talk about which days. For now just give me the list of your habits. I recommend to start small. You could always build on it.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-ADVANCED',
        },
        voice: 'mp3',
        clip: 'onboard_advanced_1',
        clipPath: '/voice/ob/onboard_advanced_1.wav',
      },
      {
        seq: 2,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-99',
          screen: 'ONBOARD-ADVANCED',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 3,
        words:
          "Those are all in, and I marked each as build or break. Tell me if any look wrong. If they're good, we'll set the days next.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-3',
          screen: 'ONBOARD-ADVANCED',
        },
        voice: 'mp3',
        clip: 'close',
        clipPath: '/voice/ob/close.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'flow.path', from: 'flow-state' }],
      dataOut: [
        {
          key: 'advanced.brainDump',
          from: 'flow-state',
          writtenBy: 'submit_brain_dump',
          persistsTo: 'per handler',
        },
      ],
    },
  },
  {
    id: 'advanced-frequency',
    name: 'Advanced frequency',
    order: 55,
    path: 'advanced',
    type: 'advanced-frequency',
    screenId: 'ONBOARD-ADVANCED-FREQUENCY',
    context:
      "BEAT: Habit days, advanced.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe habits are already captured as cards. Now set how often each one runs. The day circles grow out of the same cards. Parse a full answer when they give one, ask only for what's missing. Per-habit reminders OFF by default. Go through them, then the plan is ready.\n\nDO NOT:\n- Re-ask anything already captured.\n- Turn a reminder on unless they ask.",
    allowedTools: 'add_habit, update_habit, advance_step',
    expectedResponse: 'Says the days per habit',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    script: [
      {
        seq: 1,
        words: "Please set the days that you're going to actually do these habits.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-ADVANCED-FREQUENCY',
        },
        voice: 'mp3',
        clip: 'onboard_advanced_frequency_days',
        clipPath: '/voice/ob/onboard_advanced_frequency_days.wav',
      },
      {
        seq: 2,
        words:
          'Not every habit needs to be done every day. Specific days in the week is great as well. Once a week for a certain habit, also great.',
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-2',
          screen: 'ONBOARD-ADVANCED-FREQUENCY',
        },
        voice: 'mp3',
        clip: 'onboard_advanced_frequency_1',
        clipPath: '/voice/ob/onboard_advanced_frequency_1.wav',
      },
      {
        seq: 3,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-99',
          screen: 'ONBOARD-ADVANCED-FREQUENCY',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 4,
        words: 'Your habits are all set, your plan is ready.',
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-4',
          screen: 'ONBOARD-ADVANCED-FREQUENCY',
        },
        voice: 'mp3',
        clip: 'onboard_advanced_frequency_2',
        clipPath: '/voice/ob/onboard_advanced_frequency_2.wav',
      },
    ],
    io: {
      dataIn: [
        { key: 'onboarding.habits', from: 'flow-state', note: 'parsed from the brain dump' },
      ],
      dataOut: [
        {
          key: 'onboarding.habits',
          from: 'flow-state',
          writtenBy: 'update_habit / remove_habit / add_habit',
          persistsTo: 'per handler',
        },
      ],
    },
  },
  {
    id: 'plan',
    name: 'Plan confirm',
    order: 56,
    path: 'both',
    type: 'into-app',
    screenId: 'ONBOARD-COMPLETE',
    context:
      'BEAT: Full plan.\n\nSPEAK MODE: VERBATIM_OPENER\n\nOne confirm. Show the whole plan: the check-in time, the evening reflection time, and all the habits under them. Ask if it looks right or if they want to change anything. On approval, they enter the app. This is a high-investment moment, make the line real and specific, not generic.\n\nBUTTONS (L7): tap path only. If the user is in voice, no buttons, they just say what they want. On the tap path, show two buttons, "Approve and start" and "I want to change something." Editing is voice-driven, the add / edit / delete component surfaces. Instrument users who never tap a button.',
    allowedTools: 'update_habit, confirm_plan',
    expectedResponse: 'Looks good, or an edit',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: { buttonLabel: 'Approve and start', buttonEditLabel: 'I want to change something' },
    script: [
      {
        seq: 1,
        words:
          "Here's your plan. Your check-in, your reflection, and the habits you picked. Want to start here, or change anything first?",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-COMPLETE',
        },
        voice: 'mp3',
        clip: 'onboard_complete_1',
        clipPath: '/voice/ob/onboard_complete_1.wav',
      },
    ],
    io: {
      dataIn: [
        { key: 'checkin.config', from: 'flow-state' },
        { key: 'reflection.config', from: 'flow-state' },
        { key: 'onboarding.habits', from: 'flow-state' },
      ],
      dataOut: [
        {
          key: 'plan.confirmed',
          from: 'flow-state',
          writtenBy: 'confirm_plan',
          persistsTo: 'onboarding complete (per handler)',
        },
      ],
    },
  },
  {
    id: 'weekly-blank',
    name: 'Weekly projection (blank)',
    order: 57,
    path: 'both',
    type: 'weekly-projection',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-BLANK',
    context:
      "BEAT: Weekly projection, frame 1 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe week grid animates on screen. This single line is verbatim and timed to the frame, an MP3 candidate (Cartesia, Yair Pro Clone). Say it as written, don't improvise or add. The five frames together carry the message: reporting itself is the win, weekly reassessment is the loop, a miss still counts, the one thing to avoid is the unreported gap.\n\nDO NOT:\n- Improvise or add to the line.\n- Describe the grid.",
    allowedTools: null,
    expectedResponse: 'Taps Next',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      state: 'blank',
    },
    script: [
      {
        seq: 1,
        words: 'This is your week. Blank, starting today.',
        bindsTo: {
          kind: 'component',
          element: 'opener-line',
          screen: 'ONBOARD-WEEKLY-PROJECTION-BLANK',
        },
        voice: 'mp3',
        clip: 'onboard_weekly_projection_blank_1',
        clipPath: '/voice/ob/onboard_weekly_projection_blank_1.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.habits', from: 'flow-state', note: 'projection display input' }],
      dataOut: [],
    },
  },
  {
    id: 'weekly-full',
    name: 'Weekly projection (full)',
    order: 58,
    path: 'both',
    type: 'weekly-projection',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-FULL',
    context:
      "BEAT: Weekly projection, frame 2 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe week grid fills green on screen. Verbatim, timed to the frame, an MP3 candidate. Say it as written, don't improvise. This is the best-case frame, hold it lightly, the realistic frames come next.\n\nDO NOT:\n- Improvise or add.\n- Promise this is what will happen.",
    allowedTools: null,
    expectedResponse: 'Taps Next',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      state: 'full',
    },
    script: [
      {
        seq: 1,
        words: 'Best case, every day green. 100% success. That would be amazing.',
        bindsTo: {
          kind: 'component',
          element: 'opener-line',
          screen: 'ONBOARD-WEEKLY-PROJECTION-FULL',
        },
        voice: 'mp3',
        clip: 'onboard_weekly_projection_full_1',
        clipPath: '/voice/ob/onboard_weekly_projection_full_1.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.habits', from: 'flow-state', note: 'projection display input' }],
      dataOut: [],
    },
  },
  {
    id: 'weekly-p78',
    name: 'Weekly projection (78%)',
    order: 59,
    path: 'both',
    type: 'weekly-projection',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-P78',
    context:
      'BEAT: Weekly projection, frame 3 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe grid shows mostly green with a few misses. Verbatim, timed to the frame, an MP3 candidate. Say it as written. This is the realistic win frame, the one that matters most.\n\nDO NOT:\n- Improvise or add.',
    allowedTools: null,
    expectedResponse: 'Taps Next',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      state: 'p78',
    },
    script: [
      {
        seq: 1,
        words:
          'Most likely your week looks somewhere around here. Mostly green, a few misses. Still a real win.',
        bindsTo: {
          kind: 'component',
          element: 'opener-line',
          screen: 'ONBOARD-WEEKLY-PROJECTION-P78',
        },
        voice: 'mp3',
        clip: 'onboard_weekly_projection_p78_1',
        clipPath: '/voice/ob/onboard_weekly_projection_p78_1.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.habits', from: 'flow-state', note: 'projection display input' }],
      dataOut: [],
    },
  },
  {
    id: 'weekly-p36',
    name: 'Weekly projection (36%)',
    order: 60,
    path: 'both',
    type: 'weekly-projection',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-P36',
    context:
      'BEAT: Weekly projection, frame 4 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe grid shows a rough week, one streak surviving. Verbatim, timed to the frame, an MP3 candidate. Say it as written. The message: a rough week is still building, we reassess, no guilt.\n\nDO NOT:\n- Improvise or add.\n- Make a rough week sound like failure.',
    allowedTools: null,
    expectedResponse: 'Taps Next',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      state: 'p36',
    },
    script: [
      {
        seq: 1,
        words:
          "Some weeks can look like this. And even that's okay, because you're in the process and you're consistent inside the process.",
        bindsTo: {
          kind: 'component',
          element: 'opener-line',
          screen: 'ONBOARD-WEEKLY-PROJECTION-P36',
        },
        voice: 'mp3',
        clip: 'onboard_weekly_projection_p36_1',
        clipPath: '/voice/ob/onboard_weekly_projection_p36_1.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.habits', from: 'flow-state', note: 'projection display input' }],
      dataOut: [],
    },
  },
  {
    id: 'weekly-gaps',
    name: 'Weekly projection (gaps)',
    order: 61,
    path: 'both',
    type: 'weekly-projection',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-GAPS',
    context:
      'BEAT: Weekly projection, frame 5 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe grid shows empty, unreported days. Verbatim, timed to the frame, an MP3 candidate. Say it as written. This is the close: the only thing to avoid is the unreported gap, even a miss counts when you report it.\n\nDO NOT:\n- Improvise or add.\n- Shame the user. The point is reporting, not perfection.',
    allowedTools: null,
    expectedResponse: 'Taps Next',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      state: 'gaps',
    },
    script: [
      {
        seq: 1,
        words:
          'The one thing you want to avoid is this. The empty days you never reported. Stay consistent, just report it. Even a miss counts. That keeps the momentum going.',
        bindsTo: {
          kind: 'component',
          element: 'opener-line',
          screen: 'ONBOARD-WEEKLY-PROJECTION-GAPS',
        },
        voice: 'mp3',
        clip: 'onboard_weekly_projection_gaps_1',
        clipPath: '/voice/ob/onboard_weekly_projection_gaps_1.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.habits', from: 'flow-state', note: 'projection display input' }],
      dataOut: [],
    },
  },
] as const;

export const BEAT_BY_ID: Record<string, BeatEntry> = Object.fromEntries(
  BEATS_SOURCE.map((b) => [b.id, b]),
);
export const BEAT_BY_SCREEN_ID: Record<string, BeatEntry> = Object.fromEntries(
  BEATS_SOURCE.filter((b) => b.screenId).map((b) => [b.screenId as string, b]),
);

// Identity (section 1) is GENERATED from the beat's own fields, never copied
// from the head: beatId, order, path, type, screenId are per-beat facts, and
// copying them from a variantOf head would silently misreport them.
export function deriveVariantIdentity(beat: BeatEntry): NonNullable<BibleSections['identity']> {
  return {
    rows: [
      { label: 'beatId (canonical)', value: beat.id },
      { label: 'name', value: beat.name },
      { label: 'order', value: String(beat.order) },
      { label: 'path', value: beat.path },
      { label: 'type', value: beat.type },
    ],
    aliases: [
      { surface: 'screenId', value: beat.screenId ?? '(none)' },
      { surface: 'route', value: 'generated at app-reconcile (alias map)' },
      { surface: 'persisted current_step', value: beat.id },
      { surface: 'session_log value', value: beat.id },
      { surface: 'data-beat-id', value: beat.id },
    ],
    watchOut:
      'GENERATED from this beat entry (variants never inherit identity); the alias map is the app-reconcile source.',
    enforcedBy: ['id-alias-check'],
    status: 'verified',
  };
}

// Display-only resolver for variantOf inheritance (Yair 2026-07-09: beat + sub-beat,
// no copying). One level, no chains: a sub-beat's own fields win per SECTION —
// this is a per-key merge, not "sub-beat's bible or the head's bible" as a whole
// (that older shape silently inherited the WRONG beatId/order/aliases/tiles/clip
// on every filled variant). Identity is never taken from the head; it is always
// either the sub-beat's own or freshly derived (deriveVariantIdentity). Pure
// function, no side effects.
export function resolveBeatStructure(id: string): {
  readonly io?: BeatIO;
  readonly bible?: BibleSections;
  readonly inheritedFrom?: string;
  readonly inheritedSections?: readonly string[];
} {
  const beat = BEAT_BY_ID[id];
  if (!beat) return {};
  if (!beat.variantOf) return { io: beat.io, bible: beat.bible };
  const head = BEAT_BY_ID[beat.variantOf];
  if (!head) return { io: beat.io, bible: beat.bible };

  const io = beat.io ?? head.io;
  const ioInherited = !beat.io && Boolean(head.io);

  let bible: BibleSections | undefined;
  let inheritedSections: readonly string[] = [];
  if (head.bible || beat.bible) {
    // Cast: at least one side is defined here (the `if` guard), so the spread
    // always yields a complete BibleSections at runtime even though TS can't
    // narrow that fact through the `||` check on two independently-optional values.
    bible = {
      ...head.bible,
      ...beat.bible,
      identity: beat.bible?.identity ?? deriveVariantIdentity(beat),
    } as BibleSections;
    inheritedSections = Object.keys(head.bible ?? {}).filter(
      (key) => key !== 'identity' && !(beat.bible && key in beat.bible),
    );
  }

  const inheritedFrom = ioInherited || inheritedSections.length > 0 ? beat.variantOf : undefined;

  return { io, bible, inheritedFrom, inheritedSections };
}
