// THE ONE SOURCE for the onboarding render. Each beat lives in ONE entry here:
// the left fields (id, name, order, path, type, context, allowedTools,
// expectedResponse, voiceEngine, voiceMode) plus the right field, script[] (the
// ordered lines the engine plays and runs: seq, words, bindsTo, voice, clip).
// Consolidated once from onboardingMetadata.json + screen_contexts.json (context)
// + beatNarration/voiceClips/clipCaptions (script), which are now retired or thin
// re-exports of this file. The annotated render, the center phone, and #play all
// read this single store. Do NOT re-add a second hand-authored metadata store;
// edit this file. (Pass 2 applies the screenId -> beatId rename.)

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

export interface BeatEntry {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly path: BeatPath;
  readonly type: string;
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
  },
  {
    id: 'profile',
    name: 'Profile (age + gender)',
    order: 5,
    path: 'both',
    type: 'profile-beat',
    screenId: 'ONBOARD-01--FORM',
    context:
      "BEAT: Profile.\n\nSPEAK MODE: VERBATIM_OPENER\n\nYou already know the user's name from sign-in. Greet them by name, warmly, and collect two things: their age and their gender. Ask gender plainly, and never let them skip or decline it. Accept voice or taps. If they give one, ask for the other. Both are required before moving on, gender included. Don't ask for anything else.",
    allowedTools: 'submit_profile, advance_step',
    expectedResponse: 'Says or taps age and gender',
    voiceEngine: 'Cartesia',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    elements: ['age', 'gender'],
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
      {
        seq: 2,
        words: 'How old are you?',
        bindsTo: {
          kind: 'component',
          element: 'age',
          screen: 'ONBOARD-01--FORM',
        },
        voice: 'mp3',
        clip: 'onboard_01_form_1',
        clipPath: '/voice/ob/onboard_01_form_1.wav',
      },
      {
        seq: 3,
        words: "What's your gender?",
        bindsTo: {
          kind: 'component',
          element: 'gender',
          screen: 'ONBOARD-01--FORM',
        },
        voice: 'mp3',
        clip: 'onboard_01_form_2',
        clipPath: '/voice/ob/onboard_01_form_2.wav',
      },
    ],
  },
  {
    id: 'state-check',
    name: 'State check-in',
    order: 6,
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
  },
  {
    id: 'checkin',
    name: 'Morning check-in setup',
    order: 7,
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
      {
        seq: 3,
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
        seq: 4,
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
        seq: 5,
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
    ],
  },
  {
    id: 'reflection',
    name: 'Evening reflection setup',
    order: 8,
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
  },
  {
    id: 'fork',
    name: 'Path fork',
    order: 9,
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
  },
  {
    id: 'category',
    name: 'Category',
    order: 10,
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
  },
  {
    id: 'category-women',
    name: 'Category (women’s art)',
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
    props: {
      variant: 'female',
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
  },
  {
    id: 'goals',
    name: 'Goals',
    order: 12,
    path: 'beginner',
    type: 'goals-list',
    screenId: 'ONBOARD-BEGINNER-02',
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    script: [
      {
        seq: 1,
        words: 'So within that, which goals would you like to start with? Pick one or two.',
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_1',
        clipPath: '/voice/ob/onboard_beginner_02_1.wav',
      },
    ],
  },
  {
    id: 'goal-custom',
    name: 'Create your own goal',
    order: 13,
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
  },
  {
    id: 'habits',
    name: 'Habits',
    order: 14,
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
  },
  {
    id: 'habit-custom',
    name: 'Create your own habit',
    order: 15,
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
  },
  {
    id: 'schedule',
    name: 'Habit schedule',
    order: 16,
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
  },
  {
    id: 'advanced-capture',
    name: 'Advanced capture',
    order: 17,
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
  },
  {
    id: 'advanced-frequency',
    name: 'Advanced frequency',
    order: 18,
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
        clip: 'onboard_beginner_04_1',
        clipPath: '/voice/ob/onboard_beginner_04_1.wav',
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
  },
  {
    id: 'plan',
    name: 'Plan confirm',
    order: 19,
    path: 'both',
    type: 'into-app',
    screenId: 'ONBOARD-COMPLETE',
    context:
      'BEAT: Full plan.\n\nSPEAK MODE: VERBATIM_OPENER\n\nOne confirm. Show the whole plan: the check-in time, the evening reflection time, and all the habits under them. Ask if it looks right or if they want to change anything. On approval, they enter the app. This is a high-investment moment, make the line real and specific, not generic.',
    allowedTools: 'update_habit, confirm_plan',
    expectedResponse: 'Looks good, or an edit',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: { buttonLabel: 'Start' },
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
  },
  {
    id: 'weekly-blank',
    name: 'Weekly projection (blank)',
    order: 20,
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
  },
  {
    id: 'weekly-full',
    name: 'Weekly projection (full)',
    order: 21,
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
  },
  {
    id: 'weekly-p78',
    name: 'Weekly projection (78%)',
    order: 22,
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
  },
  {
    id: 'weekly-p36',
    name: 'Weekly projection (36%)',
    order: 23,
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
  },
  {
    id: 'weekly-gaps',
    name: 'Weekly projection (gaps)',
    order: 24,
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
  },
] as const;

export const BEAT_BY_ID: Record<string, BeatEntry> = Object.fromEntries(
  BEATS_SOURCE.map((b) => [b.id, b]),
);
export const BEAT_BY_SCREEN_ID: Record<string, BeatEntry> = Object.fromEntries(
  BEATS_SOURCE.filter((b) => b.screenId).map((b) => [b.screenId as string, b]),
);
