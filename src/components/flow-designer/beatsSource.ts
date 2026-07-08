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
export type BeatRuleSeverity = 'must' | 'should';

export interface BeatRule {
  readonly id: string;
  readonly rule: string;
  readonly severity: BeatRuleSeverity;
  readonly enforcedBy: string | null;
}

export interface BeatRules {
  readonly context: readonly BeatRule[];
  readonly code: readonly BeatRule[];
}

export interface ScriptLine {
  readonly seq: number;
  readonly words: string;
  readonly bindsTo: { readonly kind: BindKind; readonly element: string; readonly screen: string };
  readonly voice: ScriptVoice;
  readonly clip: string | null;
  readonly clipPath: string | null;
  readonly expectedUser?: string;
}

export interface BeatLegacyMeta {
  readonly opener: string | null;
  readonly secondBubble: string | null;
  readonly closeBubble: string | null;
  readonly confirmBubble: string | null;
  readonly buttonLabel: string | null;
  readonly openerMode: string | null;
  readonly openerShowsAsBubble: boolean | null;
  readonly variable: boolean;
  readonly variableNote: string | null;
  readonly clipNote: string | null;
  readonly engine: string;
  readonly scripted: boolean | null;
  readonly narration:
    | readonly { say: string; reveal?: number; clip?: string; bubble?: number; audioSrc?: string }[]
    | null;
  readonly elements: readonly { elementId: string; line: string; order: number; showsAsBubble: boolean; clip?: string; defaultValue?: string; engine?: string }[];
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
  readonly legacy: BeatLegacyMeta | null;
  readonly rules?: BeatRules;
  readonly script: readonly ScriptLine[];
}

export const GLOBAL_RULES: BeatRules = {
  context: [
    {
      id: 'global-context-voice-no-manual-ui',
      rule: 'Coach voice never tells the user to tap, click, scroll, press, swipe, or long press.',
      severity: 'must',
      enforcedBy: 'prose-only-accepted',
    },
    {
      id: 'global-context-guided-growth-name',
      rule: 'Product copy says Guided Growth.',
      severity: 'must',
      enforcedBy: 'parity-walk',
    },
  ],
  code: [
    {
      id: 'global-code-one-source',
      rule: 'The annotated render and play view read beats from BEATS_SOURCE.',
      severity: 'must',
      enforcedBy: 'scripts/render-consistency-check.mjs',
    },
    {
      id: 'global-code-bindings-and-clips',
      rule: 'Every script binding and clip path resolves before the render build is accepted.',
      severity: 'must',
      enforcedBy: 'scripts/render-link-integrity-check.mjs',
    },
  ],
};

export const BEATS_SOURCE: readonly BeatEntry[] = [
  {
    "id": "splash",
    "name": "Splash",
    "order": 0,
    "path": "both",
    "type": "splash",
    "screenId": null,
    "context": null,
    "allowedTools": null,
    "expectedResponse": null,
    "voiceEngine": "Silent",
    "voiceMode": null,
    "hideOrb": false,
    "props": null,
    "legacy": null,
    "script": []
  },
  {
    "id": "get-started",
    "name": "Get started",
    "order": 1,
    "path": "both",
    "type": "get-started",
    "screenId": null,
    "context": null,
    "allowedTools": null,
    "expectedResponse": null,
    "voiceEngine": "Silent",
    "voiceMode": null,
    "hideOrb": false,
    "props": null,
    "legacy": null,
    "script": []
  },
  {
    "id": "coach-greeting",
    "name": "Coach greeting",
    "order": 2,
    "path": "both",
    "type": "splash-intro",
    "screenId": "COACH-GREETING",
    "context": "BEAT: First hello.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe orb blooms and you speak for the first time. One warm line that lands the surprise of a real voice and invites them in. Then the flow moves on.",
    "allowedTools": null,
    "expectedResponse": "Auto-advances",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": true,
    "props": null,
    "legacy": {
      "opener": "Hey, I might have startled you. You're probably not used to an app just talking to you. I'm your AI coach here at your service at Guided Growth, and I'm excited to help you improve things in your life that are important to you. So let's get you in, and we'll get started.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "MP3",
      "scripted": true,
      "narration": [
        {
          "say": "Hey, I might have startled you. You're probably not used to an app just talking to you. I'm your AI coach here at your service at Guided Growth, and I'm excited to help you improve things in your life that are important to you. So let's get you in, and we'll get started.",
          "bubble": 1,
          "audioSrc": "/voice/splash_welcome.mp3"
        }
      ],
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Hey, I might have startled you. You're probably not used to an app just talking to you. I'm your AI coach here at your service at Guided Growth, and I'm excited to help you improve things in your life that are important to you. So let's get you in, and we'll get started.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "COACH-GREETING"
        },
        "voice": "mp3",
        "clip": "splash_welcome",
        "clipPath": "/voice/splash_welcome.mp3"
      }
    ]
  },
  {
    "id": "sign-up",
    "name": "Sign up",
    "order": 3,
    "path": "both",
    "type": "auth-signup",
    "screenId": "ONBOARD-AUTH--FORM",
    "context": "BEAT: Auth.\n\nThe user signs up or logs in by tapping (Apple, Google, or email). This is also where their name is captured. Stay silent. Do not greet, narrate, or call any tool. The flow advances on its own once the user is authenticated.",
    "allowedTools": null,
    "expectedResponse": "Taps Apple, Google, or email sign-in",
    "voiceEngine": "Silent",
    "voiceMode": null,
    "hideOrb": true,
    "props": null,
    "legacy": {
      "opener": null,
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": false,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Silent",
      "scripted": null,
      "narration": null,
      "elements": []
    },
    "script": []
  },
  {
    "id": "mic-permission",
    "name": "Mic permission",
    "order": 4,
    "path": "both",
    "type": "mic-permission",
    "screenId": "MIC-PERMISSION",
    "context": "BEAT: Mic permission.\n\nSPEAK MODE: VERBATIM_OPENER\n\nAsk for the mic so the user can talk to you. Keep it light, optional, no pressure. If they skip it, they can still type, and that's completely fine.",
    "allowedTools": null,
    "expectedResponse": "Taps Allow or Not now",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": true,
    "props": {
      "heading": "Allow your microphone",
      "sub": "So you can talk with your coach out loud."
    },
    "legacy": {
      "opener": "I'd love to actually talk with you. If you let me use your mic, you can just speak.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": false,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "MP3",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "I'd love to actually talk with you. If you let me use your mic, you can just speak.",
        "bindsTo": {
          "kind": "component",
          "element": "opener-line",
          "screen": "MIC-PERMISSION"
        },
        "voice": "mp3",
        "clip": "mic_permission_1",
        "clipPath": "/voice/ob/mic_permission_1.wav"
      }
    ]
  },
  {
    "id": "profile",
    "name": "Profile (age + gender)",
    "order": 5,
    "path": "both",
    "type": "profile-beat",
    "screenId": "ONBOARD-01--FORM",
    "context": "BEAT: Profile.\n\nSPEAK MODE: VERBATIM_OPENER\n\nYou already know the user's name from sign-in. Greet them by name, warmly, and collect two things: their age and their gender. Ask gender plainly, and never let them skip or decline it. Accept voice or taps. If they give one, ask for the other. Both are required before moving on, gender included. Don't ask for anything else.",
    "allowedTools": "submit_profile, advance_step",
    "expectedResponse": "Says or taps age and gender",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": null,
    "legacy": {
      "opener": "Good to meet you, {name}. Two quick things so I can tailor this to you.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": true,
      "variableNote": "greeting is live Cartesia (name); the age and gender asks are MP3",
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": [
        {
          "elementId": "age",
          "line": "How old are you?",
          "order": 1,
          "showsAsBubble": false,
          "engine": "MP3"
        },
        {
          "elementId": "gender",
          "line": "What's your gender?",
          "order": 2,
          "showsAsBubble": false,
          "engine": "MP3"
        }
      ]
    },
    "script": [
      {
        "seq": 1,
        "words": "Good to meet you, {name}. Two quick things so I can tailor this to you.",
        "bindsTo": {
          "kind": "bubble",
          "element": "opener",
          "screen": "ONBOARD-01--FORM"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      },
      {
        "seq": 2,
        "words": "How old are you?",
        "bindsTo": {
          "kind": "component",
          "element": "age",
          "screen": "ONBOARD-01--FORM"
        },
        "voice": "mp3",
        "clip": "onboard_01_form_1",
        "clipPath": "/voice/ob/onboard_01_form_1.wav"
      },
      {
        "seq": 3,
        "words": "What's your gender?",
        "bindsTo": {
          "kind": "component",
          "element": "gender",
          "screen": "ONBOARD-01--FORM"
        },
        "voice": "mp3",
        "clip": "onboard_01_form_2",
        "clipPath": "/voice/ob/onboard_01_form_2.wav"
      }
    ]
  },
  {
    "id": "state-check",
    "name": "State check-in",
    "order": 6,
    "path": "both",
    "type": "state-check",
    "screenId": "ONBOARD-STATE-CHECK",
    "context": "BEAT: Check-in (opener for the whole process, plus the first state check).\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe opener frames the whole coaching process: it is built on a few small pieces we go through together on the way in, it is built light for everyone (never done this, or tracks a lot), and each part gets explained as we reach it. Then this first piece: a quick state check-in, done right now. The four questions at the end (how's your sleep, mood, energy, and your stress) are the sync points, each blooms its card as it is asked, said once. Then the same cards are the check-in the user fills.\n\nDO NOT:\n- Say the four twice. They are asked once, as the four questions at the end.\n- Render a second set of cards. These cards ARE the check-in.\n- Give advice on what they report. One warm line, then move on.",
    "allowedTools": "record_checkin, advance_step",
    "expectedResponse": "Fills sleep, mood, energy, stress on the same cards",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": null,
    "legacy": {
      "opener": "I'd like to invite you into a coaching process together. And it's built on a few components we'll go through on the way in. It's built light. I believe less is more, especially in the beginning of a process.",
      "secondBubble": "Whether you've never done something like this before or you already track a lot, it is built for you. I'll explain each part as we go. This is the first part, a quick state check-in. And I'd like you to do it right now.",
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "MERGES the old why-intro and state-check into one beat. The framing shows as TWO coach bubbles, then the four questions are VERBAL ONLY (not in a bubble), each blooming its card as it is asked. Clips: state_sleep..state_stress.",
      "engine": "MP3",
      "scripted": true,
      "narration": [
        {
          "say": "I'd like to invite you into a coaching process together. And it's built on a few components we'll go through on the way in. It's built light. I believe less is more, especially in the beginning of a process.",
          "bubble": 1
        },
        {
          "say": "Whether you've never done something like this before or you already track a lot, it is built for you. I'll explain each part as we go. This is the first part, a quick state check-in. And I'd like you to do it right now.",
          "bubble": 2
        },
        {
          "say": "How's your sleep?",
          "reveal": 1,
          "clip": "state_sleep"
        },
        {
          "say": "How's your mood?",
          "reveal": 2,
          "clip": "state_mood"
        },
        {
          "say": "How's your energy?",
          "reveal": 3,
          "clip": "state_energy"
        },
        {
          "say": "How's your stress?",
          "reveal": 4,
          "clip": "state_stress"
        }
      ],
      "elements": [
        {
          "elementId": "sleep",
          "line": "How's your sleep?",
          "order": 1,
          "showsAsBubble": false,
          "clip": "state_sleep"
        },
        {
          "elementId": "mood",
          "line": "How's your mood?",
          "order": 2,
          "showsAsBubble": false,
          "clip": "state_mood"
        },
        {
          "elementId": "energy",
          "line": "How's your energy?",
          "order": 3,
          "showsAsBubble": false,
          "clip": "state_energy"
        },
        {
          "elementId": "stress",
          "line": "How's your stress?",
          "order": 4,
          "showsAsBubble": false,
          "clip": "state_stress"
        }
      ]
    },
    "script": [
      {
        "seq": 1,
        "words": "I'd like to invite you into a coaching process together. And it's built on a few components we'll go through on the way in. It's built light. I believe less is more, especially in the beginning of a process.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "ONBOARD-STATE-CHECK"
        },
        "voice": "mp3",
        "clip": "onboard_state_check_1",
        "clipPath": "/voice/ob/onboard_state_check_1.wav"
      },
      {
        "seq": 2,
        "words": "Whether you've never done something like this before or you already track a lot, it is built for you. I'll explain each part as we go. This is the first part, a quick state check-in. And I'd like you to do it right now.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-2",
          "screen": "ONBOARD-STATE-CHECK"
        },
        "voice": "mp3",
        "clip": "onboard_state_check_2",
        "clipPath": "/voice/ob/onboard_state_check_2.wav"
      },
      {
        "seq": 3,
        "words": "How's your sleep?",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-1",
          "screen": "ONBOARD-STATE-CHECK"
        },
        "voice": "mp3",
        "clip": "state_sleep",
        "clipPath": "/voice/ob/state_sleep.wav"
      },
      {
        "seq": 4,
        "words": "How's your mood?",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-2",
          "screen": "ONBOARD-STATE-CHECK"
        },
        "voice": "mp3",
        "clip": "state_mood",
        "clipPath": "/voice/ob/state_mood.wav"
      },
      {
        "seq": 5,
        "words": "How's your energy?",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-3",
          "screen": "ONBOARD-STATE-CHECK"
        },
        "voice": "mp3",
        "clip": "state_energy",
        "clipPath": "/voice/ob/state_energy.wav"
      },
      {
        "seq": 6,
        "words": "How's your stress?",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-4",
          "screen": "ONBOARD-STATE-CHECK"
        },
        "voice": "mp3",
        "clip": "state_stress",
        "clipPath": "/voice/ob/state_stress.wav"
      }
    ]
  },
  {
    "id": "checkin",
    "name": "Morning check-in setup",
    "order": 7,
    "path": "both",
    "type": "morning-checkin-setup",
    "screenId": "ONBOARD-MORNING-SETUP",
    "context": "BEAT: Check-in time.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe user just did their first check-in. Now set the daily time for it, reminder ON by default. Quick. The point isn't that it's morning, it's that this is their first habit and it's simple.",
    "allowedTools": "submit_morning_checkin, advance_step",
    "expectedResponse": "Sets a time and days",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": null,
    "legacy": {
      "opener": "Part of the coaching process is doing this each day. It gives us two things. First, it's a real quick check-in on how your state is, which is valuable, and people don't usually do it enough. And second, over time it lets us see the connection between your behavior and your state. So when would you like to do this each morning? I recommend 15 minutes after you wake up.",
      "secondBubble": "Every single day is great. But doing weekdays consistently is better than every day inconsistently. So that's what I recommend to start. But you're welcome to add the weekend as well.",
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "The opener frames why the daily check-in matters and asks for the time. The card (days, time, reminder) then blooms in visually; the coach does not read the card labels aloud.",
      "engine": "MP3",
      "scripted": true,
      "narration": [
        {
          "say": "Part of the coaching process is doing this each day. It gives us two things. First, it's a real quick check-in on how your state is, which is valuable, and people don't usually do it enough. And second, over time it lets us see the connection between your behavior and your state. So when would you like to do this each morning? I recommend 15 minutes after you wake up.",
          "bubble": 1
        },
        {
          "say": "Every single day is great. But doing weekdays consistently is better than every day inconsistently. So that's what I recommend to start. But you're welcome to add the weekend as well.",
          "bubble": 2
        },
        {
          "say": "",
          "reveal": 1
        },
        {
          "say": "",
          "reveal": 2
        },
        {
          "say": "",
          "reveal": 3
        }
      ],
      "elements": [
        {
          "elementId": "days",
          "line": "Weekdays, weekends, or your own days?",
          "order": 1,
          "showsAsBubble": false,
          "defaultValue": "Weekday preset by locale: Israel Sun to Thu, rest of world Mon to Fri"
        },
        {
          "elementId": "when",
          "line": "What time?",
          "order": 2,
          "showsAsBubble": false
        },
        {
          "elementId": "reminder",
          "line": "Want a reminder?",
          "order": 3,
          "showsAsBubble": false
        }
      ]
    },
    "script": [
      {
        "seq": 1,
        "words": "Part of the coaching process is doing this each day. It gives us two things. First, it's a real quick check-in on how your state is, which is valuable, and people don't usually do it enough. And second, over time it lets us see the connection between your behavior and your state. So when would you like to do this each morning? I recommend 15 minutes after you wake up.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "ONBOARD-MORNING-SETUP"
        },
        "voice": "mp3",
        "clip": "onboard_morning_setup_1",
        "clipPath": "/voice/ob/onboard_morning_setup_1.wav"
      },
      {
        "seq": 2,
        "words": "Every single day is great. But doing weekdays consistently is better than every day inconsistently. So that's what I recommend to start. But you're welcome to add the weekend as well.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-2",
          "screen": "ONBOARD-MORNING-SETUP"
        },
        "voice": "mp3",
        "clip": "onboard_morning_setup_2",
        "clipPath": "/voice/ob/onboard_morning_setup_2.wav"
      },
      {
        "seq": 3,
        "words": "",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-1",
          "screen": "ONBOARD-MORNING-SETUP"
        },
        "voice": "mp3",
        "clip": null,
        "clipPath": null
      },
      {
        "seq": 4,
        "words": "",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-2",
          "screen": "ONBOARD-MORNING-SETUP"
        },
        "voice": "mp3",
        "clip": null,
        "clipPath": null
      },
      {
        "seq": 5,
        "words": "",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-3",
          "screen": "ONBOARD-MORNING-SETUP"
        },
        "voice": "mp3",
        "clip": null,
        "clipPath": null
      }
    ]
  },
  {
    "id": "reflection",
    "name": "Evening reflection setup",
    "order": 8,
    "path": "both",
    "type": "reflection-card",
    "screenId": "ONBOARD-BEGINNER-07",
    "context": "BEAT: Evening reflection setup.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nSet it up, don't perform it now. The user picks one style and a time, reminder on by default. The three styles are on the screen: suggested template, your template, freeform. Don't read them out. Ask which feels right and let them pick. If they resist, keep it light, it's two minutes a day.\n\nPERSISTS: whatever they pick IS saved as their reflection template, and the daily evening reflection asks based on it, exactly: suggested template -> the three questions (what am I proud of, what do I forgive myself for, what am I grateful for); your template -> their own saved prompts, in order; freeform -> no questions, just talk. If they choose your template, capture their prompts here so the daily reflection can ask them verbatim.\n\nDO NOT:\n- Read the three styles out loud. They're on the screen.\n- Add coaching per style.\n- Make it feel like homework.",
    "allowedTools": "submit_reflection_config, submit_custom_prompts, advance_step",
    "expectedResponse": "Picks a style and time",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": null,
    "legacy": {
      "opener": "One more. An evening reflection, a couple of minutes to close out your day. Use these three questions.",
      "secondBubble": "I'd recommend doing this before bed, maybe 15 minutes before you wind down.",
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "REORGANIZED. The opener framing is one coach bubble. Then the three questions bloom one at a time, each its OWN clip and its own component (proud, then forgive, then grateful). Then, verbal only, 'Or make your own, or just talk freely' as the make-your-own / freeform switcher appears. Then the schedule blooms in as the coach introduces it: days, then the before-bed time recommendation, then the reminder. The coach does not read the card labels aloud.",
      "engine": "MP3",
      "scripted": true,
      "narration": [
        {
          "say": "One more. An evening reflection, a couple of minutes to close out your day. Use these three questions.",
          "bubble": 1
        },
        {
          "say": "What am I proud of?",
          "reveal": 1,
          "clip": "reflect_proud"
        },
        {
          "say": "What do I forgive myself for?",
          "reveal": 2,
          "clip": "reflect_forgive"
        },
        {
          "say": "What am I grateful for?",
          "reveal": 3,
          "clip": "reflect_grateful"
        },
        {
          "say": "Or make your own, or just talk freely.",
          "reveal": 4,
          "clip": "reflect_alt"
        },
        {
          "say": "",
          "reveal": 5
        },
        {
          "say": "I'd recommend doing this before bed, maybe 15 minutes before you wind down.",
          "reveal": 6,
          "clip": "reflect_time"
        },
        {
          "say": "",
          "reveal": 7
        }
      ],
      "elements": [
        {
          "elementId": "proud",
          "line": "What am I proud of?",
          "order": 1,
          "showsAsBubble": false,
          "clip": "reflect_proud"
        },
        {
          "elementId": "forgive",
          "line": "What do I forgive myself for?",
          "order": 2,
          "showsAsBubble": false,
          "clip": "reflect_forgive"
        },
        {
          "elementId": "grateful",
          "line": "What am I grateful for?",
          "order": 3,
          "showsAsBubble": false,
          "clip": "reflect_grateful"
        },
        {
          "elementId": "alt",
          "line": "Or make your own, or just talk freely.",
          "order": 4,
          "showsAsBubble": false,
          "clip": "reflect_alt"
        },
        {
          "elementId": "days",
          "line": "Which days?",
          "order": 5,
          "showsAsBubble": false,
          "defaultValue": "Weekday preset by locale: Israel Sun to Thu, rest of world Mon to Fri"
        },
        {
          "elementId": "when",
          "line": "I'd recommend doing this before bed, maybe 15 minutes before you wind down.",
          "order": 6,
          "showsAsBubble": false,
          "clip": "reflect_time"
        },
        {
          "elementId": "reminder",
          "line": "Want a reminder?",
          "order": 7,
          "showsAsBubble": false
        }
      ]
    },
    "script": [
      {
        "seq": 1,
        "words": "One more. An evening reflection, a couple of minutes to close out your day. Use these three questions.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "ONBOARD-BEGINNER-07"
        },
        "voice": "mp3",
        "clip": "onboard_beginner_07_1",
        "clipPath": "/voice/ob/onboard_beginner_07_1.wav"
      },
      {
        "seq": 2,
        "words": "What am I proud of?",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-1",
          "screen": "ONBOARD-BEGINNER-07"
        },
        "voice": "mp3",
        "clip": "reflect_proud",
        "clipPath": "/voice/ob/reflect_proud.wav"
      },
      {
        "seq": 3,
        "words": "What do I forgive myself for?",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-2",
          "screen": "ONBOARD-BEGINNER-07"
        },
        "voice": "mp3",
        "clip": "reflect_forgive",
        "clipPath": "/voice/ob/reflect_forgive.wav"
      },
      {
        "seq": 4,
        "words": "What am I grateful for?",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-3",
          "screen": "ONBOARD-BEGINNER-07"
        },
        "voice": "mp3",
        "clip": "reflect_grateful",
        "clipPath": "/voice/ob/reflect_grateful.wav"
      },
      {
        "seq": 5,
        "words": "Or make your own, or just talk freely.",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-4",
          "screen": "ONBOARD-BEGINNER-07"
        },
        "voice": "mp3",
        "clip": "reflect_alt",
        "clipPath": "/voice/ob/reflect_alt.wav"
      },
      {
        "seq": 6,
        "words": "",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-5",
          "screen": "ONBOARD-BEGINNER-07"
        },
        "voice": "mp3",
        "clip": null,
        "clipPath": null
      },
      {
        "seq": 7,
        "words": "I'd recommend doing this before bed, maybe 15 minutes before you wind down.",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-6",
          "screen": "ONBOARD-BEGINNER-07"
        },
        "voice": "mp3",
        "clip": "reflect_time",
        "clipPath": "/voice/ob/reflect_time.wav"
      },
      {
        "seq": 8,
        "words": "",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-7",
          "screen": "ONBOARD-BEGINNER-07"
        },
        "voice": "mp3",
        "clip": null,
        "clipPath": null
      }
    ]
  },
  {
    "id": "fork",
    "name": "Path fork",
    "order": 9,
    "path": "both",
    "type": "path-selection",
    "screenId": "ONBOARD-FORK--FORM",
    "context": "BEAT: Experience fork.\n\nSPEAK MODE: VERBATIM_OPENER + VERBAL_QUESTION\n\nThe framing \"For the next part of the process, I'd like to know:\" shows as one coach bubble. Then, as the two path cards appear, the question \"Do you already track habits or is this new to you?\" is spoken VERBAL ONLY (not a bubble). New, tried and dropped off, or wants guidance, route to beginner. Has a list or a system already, route to advanced. If unclear, ask one short question.\n\nDO NOT:\n- Read the two choices out loud as a list. The cards show them. Ask the question, then wait.\n- Add \"both are totally fine\" or any filler tail.",
    "allowedTools": "submit_path_choice, ask_clarification, advance_step",
    "expectedResponse": "New, or I already track habits",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": null,
    "legacy": {
      "opener": "For the next part of the process, I'd like to know:",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "The framing shows as ONE coach bubble, then the question is VERBAL ONLY (not in a bubble) as the two path cards appear. No 'both are totally fine' line. Clip: fork_question.",
      "engine": "MP3",
      "scripted": true,
      "narration": [
        {
          "say": "For the next part of the process, I'd like to know:",
          "bubble": 1
        },
        {
          "say": "Do you already track habits or is this new to you?",
          "reveal": 1,
          "clip": "fork_question"
        },
        {
          "say": "",
          "reveal": 2
        }
      ],
      "elements": [
        {
          "elementId": "question",
          "line": "Do you already track habits or is this new to you?",
          "order": 1,
          "showsAsBubble": false,
          "clip": "fork_question"
        }
      ]
    },
    "script": [
      {
        "seq": 1,
        "words": "For the next part of the process, I'd like to know:",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "ONBOARD-FORK--FORM"
        },
        "voice": "mp3",
        "clip": "onboard_fork_form_1",
        "clipPath": "/voice/ob/onboard_fork_form_1.wav"
      },
      {
        "seq": 2,
        "words": "Do you already track habits or is this new to you?",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-1",
          "screen": "ONBOARD-FORK--FORM"
        },
        "voice": "mp3",
        "clip": "fork_question",
        "clipPath": "/voice/ob/fork_question.wav"
      },
      {
        "seq": 3,
        "words": "",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-2",
          "screen": "ONBOARD-FORK--FORM"
        },
        "voice": "mp3",
        "clip": null,
        "clipPath": null
      }
    ]
  },
  {
    "id": "category",
    "name": "Category",
    "order": 10,
    "path": "beginner",
    "type": "category-grid",
    "screenId": "ONBOARD-BEGINNER-01",
    "context": "BEAT: Focus area.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nCollect one category. The opener \"Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.\" shows as a coach bubble, then the category tiles appear. When the \"Create your own\" option appears at the end, \"Or you can create your own\" is spoken VERBAL ONLY (not a bubble). Ask what they most want to work on, then wait. If they're unsure, you can talk it through with them and help them land on one, you stay open here. If they name several, ask which feels most urgent. Keep the response specific to their pick.\n\nDO NOT:\n- Read the categories out loud. They're on the screen.\n- Add commentary per category (\"sleep is the foundation\", and the like).\n- Praise the pick (\"great choice\", \"love that\").\n- Allow more than one. If they name two, ask which feels most urgent.\n- Say anything after they pick except calling submit_category and advance_step.",
    "allowedTools": "submit_category, advance_step",
    "expectedResponse": "Names or picks one category",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": null,
    "legacy": {
      "opener": "Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "The opener shows as a coach bubble, then the category tiles stagger in. When the 'Create your own' option appears at the end, the line 'Or you can create your own' is VERBAL ONLY (not in a bubble). Clip: create_your_own.",
      "engine": "MP3",
      "scripted": true,
      "narration": [
        {
          "say": "Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.",
          "bubble": 1
        },
        {
          "say": "",
          "reveal": 8
        },
        {
          "say": "Or you can create your own.",
          "reveal": 9,
          "clip": "create_your_own"
        }
      ],
      "elements": [
        {
          "elementId": "createOwn",
          "line": "Or you can create your own.",
          "order": 1,
          "showsAsBubble": false,
          "clip": "create_your_own"
        }
      ]
    },
    "script": [
      {
        "seq": 1,
        "words": "Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "ONBOARD-BEGINNER-01"
        },
        "voice": "mp3",
        "clip": "onboard_beginner_01_1",
        "clipPath": "/voice/ob/onboard_beginner_01_1.wav"
      },
      {
        "seq": 2,
        "words": "",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-8",
          "screen": "ONBOARD-BEGINNER-01"
        },
        "voice": "mp3",
        "clip": null,
        "clipPath": null
      },
      {
        "seq": 3,
        "words": "Or you can create your own.",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-9",
          "screen": "ONBOARD-BEGINNER-01"
        },
        "voice": "mp3",
        "clip": "create_your_own",
        "clipPath": "/voice/ob/create_your_own.wav"
      }
    ]
  },
  {
    "id": "category-women",
    "name": "Category (women’s art)",
    "order": 11,
    "path": "beginner",
    "type": "category-grid",
    "screenId": "ONBOARD-BEGINNER-01",
    "context": "BEAT: Focus area.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nCollect one category. The opener \"Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.\" shows as a coach bubble, then the category tiles appear. When the \"Create your own\" option appears at the end, \"Or you can create your own\" is spoken VERBAL ONLY (not a bubble). Ask what they most want to work on, then wait. If they're unsure, you can talk it through with them and help them land on one, you stay open here. If they name several, ask which feels most urgent. Keep the response specific to their pick.\n\nDO NOT:\n- Read the categories out loud. They're on the screen.\n- Add commentary per category (\"sleep is the foundation\", and the like).\n- Praise the pick (\"great choice\", \"love that\").\n- Allow more than one. If they name two, ask which feels most urgent.\n- Say anything after they pick except calling submit_category and advance_step.",
    "allowedTools": "submit_category, advance_step",
    "expectedResponse": "Names or picks one category",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "variant": "female"
    },
    "legacy": {
      "opener": "Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "The opener shows as a coach bubble, then the category tiles stagger in. When the 'Create your own' option appears at the end, the line 'Or you can create your own' is VERBAL ONLY (not in a bubble). Clip: create_your_own.",
      "engine": "MP3",
      "scripted": true,
      "narration": [
        {
          "say": "Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.",
          "bubble": 1
        },
        {
          "say": "",
          "reveal": 8
        },
        {
          "say": "Or you can create your own.",
          "reveal": 9,
          "clip": "create_your_own"
        }
      ],
      "elements": [
        {
          "elementId": "createOwn",
          "line": "Or you can create your own.",
          "order": 1,
          "showsAsBubble": false,
          "clip": "create_your_own"
        }
      ]
    },
    "script": [
      {
        "seq": 1,
        "words": "Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "ONBOARD-BEGINNER-01"
        },
        "voice": "mp3",
        "clip": "onboard_beginner_01_1",
        "clipPath": "/voice/ob/onboard_beginner_01_1.wav"
      },
      {
        "seq": 2,
        "words": "",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-8",
          "screen": "ONBOARD-BEGINNER-01"
        },
        "voice": "mp3",
        "clip": null,
        "clipPath": null
      },
      {
        "seq": 3,
        "words": "Or you can create your own.",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-9",
          "screen": "ONBOARD-BEGINNER-01"
        },
        "voice": "mp3",
        "clip": "create_your_own",
        "clipPath": "/voice/ob/create_your_own.wav"
      }
    ]
  },
  {
    "id": "goals",
    "name": "Goals",
    "order": 12,
    "path": "beginner",
    "type": "goals-list",
    "screenId": "ONBOARD-BEGINNER-02",
    "context": "BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them \"Goals\"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They're on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.",
    "allowedTools": "submit_goals, advance_step",
    "expectedResponse": "Names or picks 1 to 2 goals",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": null,
    "legacy": {
      "opener": "So within that, which goals would you like to start with? Pick one or two.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "The list is the user's goals within the chosen category (labeled 'Goals', not 'subcategory'). One or two goals. This choice branches the next beat: two goals means one habit per goal, one goal means one or two habits.",
      "engine": "MP3",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "So within that, which goals would you like to start with? Pick one or two.",
        "bindsTo": {
          "kind": "bubble",
          "element": "opener",
          "screen": "ONBOARD-BEGINNER-02"
        },
        "voice": "mp3",
        "clip": "onboard_beginner_02_1",
        "clipPath": "/voice/ob/onboard_beginner_02_1.wav"
      }
    ]
  },
  {
    "id": "goal-custom",
    "name": "Create your own goal",
    "order": 13,
    "path": "beginner",
    "type": "custom-entry",
    "screenId": "ONBOARD-BEGINNER-02-CUSTOM",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "Names their own goal",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "kind": "goal"
    },
    "legacy": {
      "opener": "Tell me the goal you want to add, and I'll set it up.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "Create-your-own-goal screen, reached from 'Create your own goal'. A simple name-your-goal field, then back into the flow.",
      "engine": "MP3",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Tell me the goal you want to add, and I'll set it up.",
        "bindsTo": {
          "kind": "bubble",
          "element": "opener",
          "screen": "ONBOARD-BEGINNER-02-CUSTOM"
        },
        "voice": "mp3",
        "clip": "onboard_beginner_02_custom_1",
        "clipPath": "/voice/ob/onboard_beginner_02_custom_1.wav"
      }
    ]
  },
  {
    "id": "habits",
    "name": "Habits",
    "order": 14,
    "path": "beginner",
    "type": "habit-picker",
    "screenId": "ONBOARD-BEGINNER-03",
    "context": "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
    "allowedTools": "add_habit, remove_habit, advance_step",
    "expectedResponse": "Picks habits: one per goal if two goals, one or two if one goal",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": null,
    "legacy": {
      "opener": "Pick one or two habits that feel doable. One habit that you actually keep is much better than a list of five that you don't keep. Create your own if nothing here fits.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "BRANCHES ON THE GOALS PICKED IN BEAT 12. Two goals: one habit per goal (two total, one each), one panel per goal. One goal: one or two habits for that goal. 'Create your own' is shown as its own element for a custom habit. Less is more: one habit kept beats five dropped.",
      "engine": "MP3",
      "scripted": true,
      "narration": null,
      "elements": [
        {
          "elementId": "createOwn",
          "line": "Create your own if nothing here fits.",
          "order": 1,
          "showsAsBubble": false
        }
      ]
    },
    "script": [
      {
        "seq": 1,
        "words": "Pick one or two habits that feel doable. One habit that you actually keep is much better than a list of five that you don't keep. Create your own if nothing here fits.",
        "bindsTo": {
          "kind": "bubble",
          "element": "opener",
          "screen": "ONBOARD-BEGINNER-03"
        },
        "voice": "mp3",
        "clip": "onboard_beginner_03_1",
        "clipPath": "/voice/ob/onboard_beginner_03_1.wav"
      },
      {
        "seq": 2,
        "words": "Create your own if nothing here fits.",
        "bindsTo": {
          "kind": "component",
          "element": "createOwn",
          "screen": "ONBOARD-BEGINNER-03"
        },
        "voice": "mp3",
        "clip": null,
        "clipPath": null
      }
    ]
  },
  {
    "id": "habit-custom",
    "name": "Create your own habit",
    "order": 15,
    "path": "beginner",
    "type": "custom-entry",
    "screenId": "ONBOARD-BEGINNER-03-CUSTOM",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "Names their own habit",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "kind": "habit"
    },
    "legacy": {
      "opener": "Tell me the habit you want to add, and I'll set it up.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "Create-your-own-habit screen, reached from 'Create your own habit'. A simple name-your-habit field, then back into the flow.",
      "engine": "MP3",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Tell me the habit you want to add, and I'll set it up.",
        "bindsTo": {
          "kind": "bubble",
          "element": "opener",
          "screen": "ONBOARD-BEGINNER-03-CUSTOM"
        },
        "voice": "mp3",
        "clip": "onboard_beginner_03_custom_1",
        "clipPath": "/voice/ob/onboard_beginner_03_custom_1.wav"
      }
    ]
  },
  {
    "id": "schedule",
    "name": "Habit schedule",
    "order": 16,
    "path": "beginner",
    "type": "habit-schedule",
    "screenId": "ONBOARD-BEGINNER-04",
    "context": "BEAT: Habit schedule.\n\nSPEAK MODE: VERBATIM_OPENER\n\nShows ALL the habits the user just picked, each as its own card with the habit name and its day picker (the frequency). The daily check-in and the evening reflection are NOT here, they are rituals, not habits. For each habit, set which days. Recommend weekdays to start. Days default to the weekday preset by locale. Per-habit reminders are OFF by default, on only if the user asks.\n\nDO NOT:\n- Turn a per-habit reminder on unless they ask.\n- Re-ask a piece they already gave.\n- Include the check-in or the reflection as habits here.",
    "allowedTools": "add_habit, update_habit, advance_step",
    "expectedResponse": "Sets the days per habit",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": null,
    "legacy": {
      "opener": "Please set the days that you're going to actually do these habits.",
      "secondBubble": "Not every habit needs to be done every day. Three specific days in the week is great as well. Once a week for specific habits, also great.",
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "Two coach bubbles: 'Please set the days...' then 'Not every habit needs to be done every day. Three specific days in the week is great as well. Once a week for specific habits, also great.' Then lists ALL the habits the user just picked, each as its own card with the habit name and its day picker (the frequency). The daily check-in and the evening reflection are NOT here (they are rituals, not habits). Days default to the weekday preset by locale.",
      "engine": "MP3",
      "scripted": true,
      "narration": [
        {
          "say": "Please set the days that you're going to actually do these habits.",
          "bubble": 1
        },
        {
          "say": "Not every habit needs to be done every day. Three specific days in the week is great as well. Once a week for specific habits, also great.",
          "bubble": 2
        },
        {
          "say": "",
          "reveal": 99
        }
      ],
      "elements": [
        {
          "elementId": "days",
          "line": "Which days for each one?",
          "order": 1,
          "showsAsBubble": false,
          "defaultValue": "Weekday preset by locale: Israel Sun to Thu, rest of world Mon to Fri"
        }
      ]
    },
    "script": [
      {
        "seq": 1,
        "words": "Please set the days that you're going to actually do these habits.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "ONBOARD-BEGINNER-04"
        },
        "voice": "mp3",
        "clip": "onboard_beginner_04_1",
        "clipPath": "/voice/ob/onboard_beginner_04_1.wav"
      },
      {
        "seq": 2,
        "words": "Not every habit needs to be done every day. Three specific days in the week is great as well. Once a week for specific habits, also great.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-2",
          "screen": "ONBOARD-BEGINNER-04"
        },
        "voice": "mp3",
        "clip": "onboard_beginner_04_2",
        "clipPath": "/voice/ob/onboard_beginner_04_2.wav"
      },
      {
        "seq": 3,
        "words": "",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-99",
          "screen": "ONBOARD-BEGINNER-04"
        },
        "voice": "mp3",
        "clip": null,
        "clipPath": null
      }
    ]
  },
  {
    "id": "advanced-capture",
    "name": "Advanced capture",
    "order": 17,
    "path": "advanced",
    "type": "advanced-capture",
    "screenId": "ONBOARD-ADVANCED",
    "context": "BEAT: Advanced capture.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe user already has habits. Let them read or type them all, in their own words. Each one forms on screen as a card, and each card is auto marked build or break (avoidance wording reads as break, everything else as build). You do NOT ask build or break per habit. Capture verbatim, don't reorganize as they talk. Less is more, especially at the start, they can build on it later. When they finish, name the build and break read once over the whole set and ask for a single yes. If they flag one as wrong, fix that one. Then the days get set on the next beat.\n\nDO NOT:\n- Ask build or break for each habit. The cards already mark it.\n- Reword or reorganize what they said.\n- Push for more. Less is more.",
    "allowedTools": "submit_brain_dump, advance_step",
    "expectedResponse": "Reads or types their habits",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": null,
    "legacy": {
      "opener": "Read me the list of the habits that you already track. In the next step we'll talk about which days. For now just give me the list of your habits. I recommend to start small. You could always build on it.",
      "secondBubble": null,
      "closeBubble": "Those are all in, and I marked each as build or break. Tell me if any look wrong. If they're good, we'll set the days next.",
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "Just the list here, no days yet. Each habit forms live as a card with an auto Build/Break chip. No 'listening/all captured' banner once done. Close line names the build/break read: 'Those are all in, and I marked each as build or break. Tell me if any look wrong. If they're good, we'll set the days next.'",
      "engine": "MP3",
      "scripted": true,
      "narration": [
        {
          "say": "Read me the list of the habits that you already track. In the next step we'll talk about which days. For now just give me the list of your habits. I recommend to start small. You could always build on it.",
          "bubble": 1
        },
        {
          "say": "",
          "reveal": 99
        },
        {
          "say": "Those are all in, and I marked each as build or break. Tell me if any look wrong. If they're good, we'll set the days next.",
          "bubble": 3
        }
      ],
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Read me the list of the habits that you already track. In the next step we'll talk about which days. For now just give me the list of your habits. I recommend to start small. You could always build on it.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "ONBOARD-ADVANCED"
        },
        "voice": "mp3",
        "clip": "onboard_advanced_1",
        "clipPath": "/voice/ob/onboard_advanced_1.wav"
      },
      {
        "seq": 2,
        "words": "",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-99",
          "screen": "ONBOARD-ADVANCED"
        },
        "voice": "mp3",
        "clip": null,
        "clipPath": null
      },
      {
        "seq": 3,
        "words": "Those are all in, and I marked each as build or break. Tell me if any look wrong. If they're good, we'll set the days next.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-3",
          "screen": "ONBOARD-ADVANCED"
        },
        "voice": "mp3",
        "clip": "close",
        "clipPath": "/voice/ob/close.wav"
      }
    ]
  },
  {
    "id": "advanced-frequency",
    "name": "Advanced frequency",
    "order": 18,
    "path": "advanced",
    "type": "advanced-frequency",
    "screenId": "ONBOARD-ADVANCED-FREQUENCY",
    "context": "BEAT: Habit days, advanced.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe habits are already captured as cards. Now set how often each one runs. The day circles grow out of the same cards. Parse a full answer when they give one, ask only for what's missing. Per-habit reminders OFF by default. Go through them, then the plan is ready.\n\nDO NOT:\n- Re-ask anything already captured.\n- Turn a reminder on unless they ask.",
    "allowedTools": "add_habit, update_habit, advance_step",
    "expectedResponse": "Says the days per habit",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": null,
    "legacy": {
      "opener": "Please set the days that you're going to actually do these habits.",
      "secondBubble": "Not every habit needs to be done every day. Specific days in the week is great as well. Once a week for a certain habit, also great.",
      "closeBubble": null,
      "confirmBubble": "Your habits are all set, your plan is ready.",
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "Advanced path day-setting. Two coach bubbles, then the habit cards' day pickers grow out, then a closing confirm bubble.",
      "engine": "MP3",
      "scripted": true,
      "narration": [
        {
          "say": "Please set the days that you're going to actually do these habits.",
          "bubble": 1
        },
        {
          "say": "Not every habit needs to be done every day. Specific days in the week is great as well. Once a week for a certain habit, also great.",
          "bubble": 2
        },
        {
          "say": "",
          "reveal": 99
        },
        {
          "say": "Your habits are all set, your plan is ready.",
          "bubble": 4
        }
      ],
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Please set the days that you're going to actually do these habits.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "ONBOARD-ADVANCED-FREQUENCY"
        },
        "voice": "mp3",
        "clip": "onboard_beginner_04_1",
        "clipPath": "/voice/ob/onboard_beginner_04_1.wav"
      },
      {
        "seq": 2,
        "words": "Not every habit needs to be done every day. Specific days in the week is great as well. Once a week for a certain habit, also great.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-2",
          "screen": "ONBOARD-ADVANCED-FREQUENCY"
        },
        "voice": "mp3",
        "clip": "onboard_advanced_frequency_1",
        "clipPath": "/voice/ob/onboard_advanced_frequency_1.wav"
      },
      {
        "seq": 3,
        "words": "",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-99",
          "screen": "ONBOARD-ADVANCED-FREQUENCY"
        },
        "voice": "mp3",
        "clip": null,
        "clipPath": null
      },
      {
        "seq": 4,
        "words": "Your habits are all set, your plan is ready.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-4",
          "screen": "ONBOARD-ADVANCED-FREQUENCY"
        },
        "voice": "mp3",
        "clip": "onboard_advanced_frequency_2",
        "clipPath": "/voice/ob/onboard_advanced_frequency_2.wav"
      }
    ]
  },
  {
    "id": "plan",
    "name": "Plan confirm",
    "order": 19,
    "path": "both",
    "type": "into-app",
    "screenId": "ONBOARD-COMPLETE",
    "context": "BEAT: Full plan.\n\nSPEAK MODE: VERBATIM_OPENER\n\nOne confirm. Show the whole plan: the check-in time, the evening reflection time, and all the habits under them. Ask if it looks right or if they want to change anything. On approval, they enter the app. This is a high-investment moment, make the line real and specific, not generic.",
    "allowedTools": "update_habit, confirm_plan",
    "expectedResponse": "Looks good, or an edit",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": null,
    "legacy": {
      "opener": "Here's your plan. Your check-in, your reflection, and the habits you picked. Want to start here, or change anything first?",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": "Start",
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "MP3",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Here's your plan. Your check-in, your reflection, and the habits you picked. Want to start here, or change anything first?",
        "bindsTo": {
          "kind": "bubble",
          "element": "opener",
          "screen": "ONBOARD-COMPLETE"
        },
        "voice": "mp3",
        "clip": "onboard_complete_1",
        "clipPath": "/voice/ob/onboard_complete_1.wav"
      }
    ]
  },
  {
    "id": "weekly-blank",
    "name": "Weekly projection (blank)",
    "order": 20,
    "path": "both",
    "type": "weekly-projection",
    "screenId": "ONBOARD-WEEKLY-PROJECTION-BLANK",
    "context": "BEAT: Weekly projection, frame 1 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe week grid animates on screen. This single line is verbatim and timed to the frame, an MP3 candidate (Cartesia, Yair Pro Clone). Say it as written, don't improvise or add. The five frames together carry the message: reporting itself is the win, weekly reassessment is the loop, a miss still counts, the one thing to avoid is the unreported gap.\n\nDO NOT:\n- Improvise or add to the line.\n- Describe the grid.",
    "allowedTools": null,
    "expectedResponse": "Taps Next",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "state": "blank"
    },
    "legacy": {
      "opener": "This is your week. Blank, starting today.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": false,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "MP3",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "This is your week. Blank, starting today.",
        "bindsTo": {
          "kind": "component",
          "element": "opener-line",
          "screen": "ONBOARD-WEEKLY-PROJECTION-BLANK"
        },
        "voice": "mp3",
        "clip": "onboard_weekly_projection_blank_1",
        "clipPath": "/voice/ob/onboard_weekly_projection_blank_1.wav"
      }
    ]
  },
  {
    "id": "weekly-full",
    "name": "Weekly projection (full)",
    "order": 21,
    "path": "both",
    "type": "weekly-projection",
    "screenId": "ONBOARD-WEEKLY-PROJECTION-FULL",
    "context": "BEAT: Weekly projection, frame 2 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe week grid fills green on screen. Verbatim, timed to the frame, an MP3 candidate. Say it as written, don't improvise. This is the best-case frame, hold it lightly, the realistic frames come next.\n\nDO NOT:\n- Improvise or add.\n- Promise this is what will happen.",
    "allowedTools": null,
    "expectedResponse": "Taps Next",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "state": "full"
    },
    "legacy": {
      "opener": "Best case, every day green. 100% success. That would be amazing.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": false,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "MP3",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Best case, every day green. 100% success. That would be amazing.",
        "bindsTo": {
          "kind": "component",
          "element": "opener-line",
          "screen": "ONBOARD-WEEKLY-PROJECTION-FULL"
        },
        "voice": "mp3",
        "clip": "onboard_weekly_projection_full_1",
        "clipPath": "/voice/ob/onboard_weekly_projection_full_1.wav"
      }
    ]
  },
  {
    "id": "weekly-p78",
    "name": "Weekly projection (78%)",
    "order": 22,
    "path": "both",
    "type": "weekly-projection",
    "screenId": "ONBOARD-WEEKLY-PROJECTION-P78",
    "context": "BEAT: Weekly projection, frame 3 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe grid shows mostly green with a few misses. Verbatim, timed to the frame, an MP3 candidate. Say it as written. This is the realistic win frame, the one that matters most.\n\nDO NOT:\n- Improvise or add.",
    "allowedTools": null,
    "expectedResponse": "Taps Next",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "state": "p78"
    },
    "legacy": {
      "opener": "Most likely your week looks somewhere around here. Mostly green, a few misses. Still a real win.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": false,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "MP3",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Most likely your week looks somewhere around here. Mostly green, a few misses. Still a real win.",
        "bindsTo": {
          "kind": "component",
          "element": "opener-line",
          "screen": "ONBOARD-WEEKLY-PROJECTION-P78"
        },
        "voice": "mp3",
        "clip": "onboard_weekly_projection_p78_1",
        "clipPath": "/voice/ob/onboard_weekly_projection_p78_1.wav"
      }
    ]
  },
  {
    "id": "weekly-p36",
    "name": "Weekly projection (36%)",
    "order": 23,
    "path": "both",
    "type": "weekly-projection",
    "screenId": "ONBOARD-WEEKLY-PROJECTION-P36",
    "context": "BEAT: Weekly projection, frame 4 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe grid shows a rough week, one streak surviving. Verbatim, timed to the frame, an MP3 candidate. Say it as written. The message: a rough week is still building, we reassess, no guilt.\n\nDO NOT:\n- Improvise or add.\n- Make a rough week sound like failure.",
    "allowedTools": null,
    "expectedResponse": "Taps Next",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "state": "p36"
    },
    "legacy": {
      "opener": "Some weeks can look like this. And even that's okay, because you're in the process and you're consistent inside the process.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": false,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "MP3",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Some weeks can look like this. And even that's okay, because you're in the process and you're consistent inside the process.",
        "bindsTo": {
          "kind": "component",
          "element": "opener-line",
          "screen": "ONBOARD-WEEKLY-PROJECTION-P36"
        },
        "voice": "mp3",
        "clip": "onboard_weekly_projection_p36_1",
        "clipPath": "/voice/ob/onboard_weekly_projection_p36_1.wav"
      }
    ]
  },
  {
    "id": "weekly-gaps",
    "name": "Weekly projection (gaps)",
    "order": 24,
    "path": "both",
    "type": "weekly-projection",
    "screenId": "ONBOARD-WEEKLY-PROJECTION-GAPS",
    "context": "BEAT: Weekly projection, frame 5 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe grid shows empty, unreported days. Verbatim, timed to the frame, an MP3 candidate. Say it as written. This is the close: the only thing to avoid is the unreported gap, even a miss counts when you report it.\n\nDO NOT:\n- Improvise or add.\n- Shame the user. The point is reporting, not perfection.",
    "allowedTools": null,
    "expectedResponse": "Taps Next",
    "voiceEngine": "MP3",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "state": "gaps"
    },
    "legacy": {
      "opener": "The one thing you want to avoid is this. The empty days you never reported. Stay consistent, just report it. Even a miss counts. That keeps the momentum going.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": false,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "MP3",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "The one thing you want to avoid is this. The empty days you never reported. Stay consistent, just report it. Even a miss counts. That keeps the momentum going.",
        "bindsTo": {
          "kind": "component",
          "element": "opener-line",
          "screen": "ONBOARD-WEEKLY-PROJECTION-GAPS"
        },
        "voice": "mp3",
        "clip": "onboard_weekly_projection_gaps_1",
        "clipPath": "/voice/ob/onboard_weekly_projection_gaps_1.wav"
      }
    ]
  },
  {
    "id": "app-tour-morning",
    "name": "App tour, morning check-in",
    "order": 25,
    "path": "both",
    "type": "home-tour",
    "screenId": "APP-TOUR-MORNING",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "Auto-advances through the tour",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "userName": "{name}",
      "stage": "morning",
      "coachLine": "Mornings start with a quick check-in, {name}. Just say you're ready, and we'll see how you slept and where you're at."
    },
    "legacy": {
      "opener": "Mornings start with a quick check-in, {name}. Just say you're ready, and we'll see how you slept and where you're at.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": true,
      "variableNote": "name is live Cartesia",
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Mornings start with a quick check-in, {name}. Just say you're ready, and we'll see how you slept and where you're at.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "APP-TOUR-MORNING"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "app-tour-context-one-feature",
          "rule": "Coach explains one home feature per beat, then waits for the next tour beat.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "app-tour-context-no-manual-ui",
          "rule": "Coach narration does not instruct the user to tap or scroll through the tour.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        }
      ],
      "code": [
        {
          "id": "app-tour-code-home-tour-stage",
          "rule": "Each app tour beat renders the home-tour component with a stage prop.",
          "severity": "must",
          "enforcedBy": "npm:build:flow"
        },
        {
          "id": "app-tour-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "app-tour-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "app-tour-evening",
    "name": "App tour, evening reflection",
    "order": 26,
    "path": "both",
    "type": "home-tour",
    "screenId": "APP-TOUR-EVENING",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "Auto-advances through the tour",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "userName": "{name}",
      "stage": "evening",
      "coachLine": "Evenings, you reflect on the day. Just start talking to me, how it went, what's on your mind."
    },
    "legacy": {
      "opener": "Evenings, you reflect on the day. Just start talking to me, how it went, what's on your mind.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Evenings, you reflect on the day. Just start talking to me, how it went, what's on your mind.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "APP-TOUR-EVENING"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "app-tour-context-one-feature",
          "rule": "Coach explains one home feature per beat, then waits for the next tour beat.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "app-tour-context-no-manual-ui",
          "rule": "Coach narration does not instruct the user to tap or scroll through the tour.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        }
      ],
      "code": [
        {
          "id": "app-tour-code-home-tour-stage",
          "rule": "Each app tour beat renders the home-tour component with a stage prop.",
          "severity": "must",
          "enforcedBy": "npm:build:flow"
        },
        {
          "id": "app-tour-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "app-tour-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "app-tour-habits",
    "name": "App tour, habits",
    "order": 27,
    "path": "both",
    "type": "home-tour",
    "screenId": "APP-TOUR-HABITS",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "Auto-advances through the tour",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "userName": "{name}",
      "stage": "habits",
      "coachLine": "These are your habits. Tell me the ones you do, and the ones you miss. Either way works."
    },
    "legacy": {
      "opener": "These are your habits. Tell me the ones you do, and the ones you miss. Either way works.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "These are your habits. Tell me the ones you do, and the ones you miss. Either way works.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "APP-TOUR-HABITS"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "app-tour-context-one-feature",
          "rule": "Coach explains one home feature per beat, then waits for the next tour beat.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "app-tour-context-no-manual-ui",
          "rule": "Coach narration does not instruct the user to tap or scroll through the tour.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        }
      ],
      "code": [
        {
          "id": "app-tour-code-home-tour-stage",
          "rule": "Each app tour beat renders the home-tour component with a stage prop.",
          "severity": "must",
          "enforcedBy": "npm:build:flow"
        },
        {
          "id": "app-tour-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "app-tour-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "app-tour-add-habit",
    "name": "App tour, add habit",
    "order": 28,
    "path": "both",
    "type": "home-tour",
    "screenId": "APP-TOUR-ADD-HABIT",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "Auto-advances through the tour",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "userName": "{name}",
      "stage": "add-habit",
      "coachLine": "Want to track something new? Just tell me, {name}, and we'll add it together."
    },
    "legacy": {
      "opener": "Want to track something new? Just tell me, {name}, and we'll add it together.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": true,
      "variableNote": "name is live Cartesia",
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Want to track something new? Just tell me, {name}, and we'll add it together.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "APP-TOUR-ADD-HABIT"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "app-tour-context-one-feature",
          "rule": "Coach explains one home feature per beat, then waits for the next tour beat.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "app-tour-context-no-manual-ui",
          "rule": "Coach narration does not instruct the user to tap or scroll through the tour.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        }
      ],
      "code": [
        {
          "id": "app-tour-code-home-tour-stage",
          "rule": "Each app tour beat renders the home-tour component with a stage prop.",
          "severity": "must",
          "enforcedBy": "npm:build:flow"
        },
        {
          "id": "app-tour-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "app-tour-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "app-tour-reflections",
    "name": "App tour, reflections",
    "order": 29,
    "path": "both",
    "type": "home-tour",
    "screenId": "APP-TOUR-REFLECTIONS",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "Auto-advances through the tour",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "userName": "{name}",
      "stage": "reflections",
      "coachLine": "It's empty now, but this is where your reflections will live. After your first evening one, they show up here."
    },
    "legacy": {
      "opener": "It's empty now, but this is where your reflections will live. After your first evening one, they show up here.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "It's empty now, but this is where your reflections will live. After your first evening one, they show up here.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "APP-TOUR-REFLECTIONS"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "app-tour-context-one-feature",
          "rule": "Coach explains one home feature per beat, then waits for the next tour beat.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "app-tour-context-no-manual-ui",
          "rule": "Coach narration does not instruct the user to tap or scroll through the tour.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        }
      ],
      "code": [
        {
          "id": "app-tour-code-home-tour-stage",
          "rule": "Each app tour beat renders the home-tour component with a stage prop.",
          "severity": "must",
          "enforcedBy": "npm:build:flow"
        },
        {
          "id": "app-tour-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "app-tour-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "app-tour-feedback",
    "name": "App tour, feedback",
    "order": 30,
    "path": "both",
    "type": "home-tour",
    "screenId": "APP-TOUR-FEEDBACK",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "Auto-advances through the tour",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "userName": "{name}",
      "stage": "feedback",
      "coachLine": "You're one of our 50 founding users, {name}, so your feedback is one of the most meaningful things you can do for us. It shapes where this whole product goes. There's a button here for it, and you can also just tell me, anytime you've got something."
    },
    "legacy": {
      "opener": "You're one of our 50 founding users, {name}, so your feedback is one of the most meaningful things you can do for us. It shapes where this whole product goes. There's a button here for it, and you can also just tell me, anytime you've got something.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": true,
      "variableNote": "name is live Cartesia",
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "You're one of our 50 founding users, {name}, so your feedback is one of the most meaningful things you can do for us. It shapes where this whole product goes. There's a button here for it, and you can also just tell me, anytime you've got something.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "APP-TOUR-FEEDBACK"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "app-tour-context-one-feature",
          "rule": "Coach explains one home feature per beat, then waits for the next tour beat.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "app-tour-context-no-manual-ui",
          "rule": "Coach narration does not instruct the user to tap or scroll through the tour.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        }
      ],
      "code": [
        {
          "id": "app-tour-code-home-tour-stage",
          "rule": "Each app tour beat renders the home-tour component with a stage prop.",
          "severity": "must",
          "enforcedBy": "npm:build:flow"
        },
        {
          "id": "app-tour-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "app-tour-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "app-tour-chat",
    "name": "App tour, open chat",
    "order": 31,
    "path": "both",
    "type": "home-tour",
    "screenId": "APP-TOUR-CHAT",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "Auto-advances through the tour",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "userName": "{name}",
      "stage": "chat",
      "coachLine": "Great job getting here, {name}. This might be the longest you'll ever be in the app, but it was worth it to set up your foundation. The key now is consistency. It doesn't have to be long, just do it twice a day, and we'll do our best to help you improve and stay consistent. I'm right here anytime, just open the chat."
    },
    "legacy": {
      "opener": "Great job getting here, {name}. This might be the longest you'll ever be in the app, but it was worth it to set up your foundation. The key now is consistency. It doesn't have to be long, just do it twice a day, and we'll do our best to help you improve and stay consistent. I'm right here anytime, just open the chat.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": true,
      "variableNote": "name is live Cartesia",
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Great job getting here, {name}. This might be the longest you'll ever be in the app, but it was worth it to set up your foundation. The key now is consistency. It doesn't have to be long, just do it twice a day, and we'll do our best to help you improve and stay consistent. I'm right here anytime, just open the chat.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "APP-TOUR-CHAT"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "app-tour-context-one-feature",
          "rule": "Coach explains one home feature per beat, then waits for the next tour beat.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "app-tour-context-no-manual-ui",
          "rule": "Coach narration does not instruct the user to tap or scroll through the tour.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        }
      ],
      "code": [
        {
          "id": "app-tour-code-home-tour-stage",
          "rule": "Each app tour beat renders the home-tour component with a stage prop.",
          "severity": "must",
          "enforcedBy": "npm:build:flow"
        },
        {
          "id": "app-tour-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "app-tour-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "chat-idle",
    "name": "Chat idle orb",
    "order": 32,
    "path": "both",
    "type": "coach-chat-open",
    "screenId": "CHAT-IDLE",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "User opens chat or starts speaking",
    "voiceEngine": "Silent",
    "voiceMode": null,
    "hideOrb": false,
    "props": {
      "stage": "idle"
    },
    "legacy": {
      "opener": null,
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": false,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Silent",
      "scripted": null,
      "narration": null,
      "elements": []
    },
    "script": [],
    "rules": {
      "context": [
        {
          "id": "chat-idle-context-silent",
          "rule": "The centered idle orb is silent until the user opens chat or starts speaking.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "chat-idle-context-no-opener",
          "rule": "Do not invent a coach opener on the idle state.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        }
      ],
      "code": [
        {
          "id": "chat-idle-code-silent-script",
          "rule": "Idle chat has no script lines and uses voiceEngine Silent.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "chat-idle-code-component",
          "rule": "The coach-chat-open component renders the idle stage.",
          "severity": "must",
          "enforcedBy": "npm:build:flow"
        }
      ]
    }
  },
  {
    "id": "chat-open",
    "name": "Chat opens",
    "order": 33,
    "path": "both",
    "type": "coach-chat-open",
    "screenId": "CHAT-OPEN",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "User answers in voice or text",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "stage": "open",
      "coachLine": "Hey, how's your day going?"
    },
    "legacy": {
      "opener": "Hey, how's your day going?",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Hey, how's your day going?",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "CHAT-OPEN"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "chat-open-context-warm-line",
          "rule": "Coach opens with one warm line, then waits for the user.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "chat-open-context-voice-open-question",
          "rule": "Opening copy stays as the specified chat greeting until Yair decides voice versus text-only behavior.",
          "severity": "should",
          "enforcedBy": null
        }
      ],
      "code": [
        {
          "id": "chat-open-code-scripted-line",
          "rule": "The chat opener line lives in script and renders through coach-chat-open.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "chat-open-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "chat-open-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "morning-opener",
    "name": "Morning opener",
    "order": 34,
    "path": "both",
    "type": "coach-bubble",
    "screenId": "morning_opener",
    "context": "BEAT: Morning opener.\n\nSay the greeting and state ask (the time clip plays in front of it). The mood, energy, sleep, stress card renders on screen.",
    "allowedTools": null,
    "expectedResponse": "User starts morning check-in or declines",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "text": "Good morning. Ready to check in?"
    },
    "legacy": {
      "opener": "Good morning. Ready to check in?",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Good morning. Ready to check in?",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "morning_opener"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "morning-context-set-script",
          "rule": "Morning check-in uses fixed Cartesia TTS script, no improvised coach wording.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "morning-context-structured-forward",
          "rule": "The flow moves forward only: opener, state, partial gate if needed, wrap.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "morning-opener-context-short",
          "rule": "Greeting is short and hands off to the state check.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        }
      ],
      "code": [
        {
          "id": "morning-opener-code-script",
          "rule": "The opener is a single script line.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "morning-opener-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "morning-opener-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "morning-state",
    "name": "Morning state check",
    "order": 35,
    "path": "both",
    "type": "state-check",
    "screenId": "morning_state",
    "context": "BEAT: Morning state.\n\nThe user reports mood, energy, sleep, and stress on a 1 to 5 scale, by tapping the card or saying it. Record each with record_checkin. EXPLICIT REACTION: after they report, give ONE short live reaction to what they shared, warm, specific, no advice. If some of the four are still missing when they signal done, the shared are-you-done beat handles it.",
    "allowedTools": "record_checkin",
    "expectedResponse": "Reports mood, energy, sleep, and stress by voice or tap",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "coachLine": "How are you feeling this morning? Mood, energy, sleep, any stress on your mind. Just tell me where you're at."
    },
    "legacy": {
      "opener": "How are you feeling this morning? Mood, energy, sleep, any stress on your mind. Just tell me where you're at.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": [
        {
          "elementId": "sleep",
          "line": "Sleep",
          "order": 1,
          "showsAsBubble": false
        },
        {
          "elementId": "mood",
          "line": "Mood",
          "order": 2,
          "showsAsBubble": false
        },
        {
          "elementId": "energy",
          "line": "Energy",
          "order": 3,
          "showsAsBubble": false
        },
        {
          "elementId": "stress",
          "line": "Stress",
          "order": 4,
          "showsAsBubble": false
        }
      ]
    },
    "script": [
      {
        "seq": 1,
        "words": "How are you feeling this morning? Mood, energy, sleep, any stress on your mind. Just tell me where you're at.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "morning_state"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      },
      {
        "seq": 2,
        "words": "Sleep",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-1",
          "screen": "morning_state"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      },
      {
        "seq": 3,
        "words": "Mood",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-2",
          "screen": "morning_state"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      },
      {
        "seq": 4,
        "words": "Energy",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-3",
          "screen": "morning_state"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      },
      {
        "seq": 5,
        "words": "Stress",
        "bindsTo": {
          "kind": "component",
          "element": "reveal-4",
          "screen": "morning_state"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "morning-context-set-script",
          "rule": "Morning check-in uses fixed Cartesia TTS script, no improvised coach wording.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "morning-context-structured-forward",
          "rule": "The flow moves forward only: opener, state, partial gate if needed, wrap.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "morning-state-context-four-items",
          "rule": "Ask only for mood, energy, sleep, and stress.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        }
      ],
      "code": [
        {
          "id": "morning-state-code-record-checkin-tool",
          "rule": "The beat declares record_checkin in allowedTools.",
          "severity": "must",
          "enforcedBy": "schema:BeatEntry"
        },
        {
          "id": "morning-state-code-reveal-four-items",
          "rule": "The state card exposes four component reveal rows.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "morning-state-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "morning-state-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "morning-are-you-done",
    "name": "Morning partial gate",
    "order": 36,
    "path": "both",
    "type": "coach-bubble",
    "screenId": "are_you_done",
    "context": "BEAT: Are you done (shared, morning and evening).\n\nOnly when a bounded step (the four morning items, or the evening habit list) is left partial. Say the are-you-done line ONCE. The user adds the rest or says they're done. Either way, move on. Never re-ask, never loop, never block. Governed by the Global are-you-done rule.",
    "allowedTools": null,
    "expectedResponse": "Adds remaining items or says done",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "text": "Looks like there are a few items left. Want to add anything, or should we move on?"
    },
    "legacy": {
      "opener": "Looks like there are a few items left. Want to add anything, or should we move on?",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Looks like there are a few items left. Want to add anything, or should we move on?",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "are_you_done"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null,
        "expectedUser": "User adds missing state items or says done"
      }
    ],
    "rules": {
      "context": [
        {
          "id": "morning-context-set-script",
          "rule": "Morning check-in uses fixed Cartesia TTS script, no improvised coach wording.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "morning-context-structured-forward",
          "rule": "The flow moves forward only: opener, state, partial gate if needed, wrap.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "morning-done-context-once",
          "rule": "Ask are you done only once when some bounded state items were skipped.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        }
      ],
      "code": [
        {
          "id": "morning-done-code-expected-user",
          "rule": "The script records the expected user continuation or done response.",
          "severity": "must",
          "enforcedBy": "schema:ScriptLine"
        },
        {
          "id": "morning-done-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "morning-done-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "morning-wrap",
    "name": "Morning wrap",
    "order": 37,
    "path": "both",
    "type": "coach-bubble",
    "screenId": "morning_wrap",
    "context": "BEAT: Morning wrap.\n\nSay the wrap line, then end. Add nothing after, no coaching, no extra line.",
    "allowedTools": null,
    "expectedResponse": "Auto-ends morning check-in",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "text": "That's a good start. Go make it a good one."
    },
    "legacy": {
      "opener": "That's a good start. Go make it a good one.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "That's a good start. Go make it a good one.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "morning_wrap"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "morning-context-set-script",
          "rule": "Morning check-in uses fixed Cartesia TTS script, no improvised coach wording.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "morning-context-structured-forward",
          "rule": "The flow moves forward only: opener, state, partial gate if needed, wrap.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "morning-wrap-context-end",
          "rule": "Wrap line ends the morning check-in and adds no extra coaching.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        }
      ],
      "code": [
        {
          "id": "morning-wrap-code-script",
          "rule": "The wrap is a single script line.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "morning-wrap-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "morning-wrap-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "evening-opener",
    "name": "Evening opener and habits",
    "order": 38,
    "path": "both",
    "type": "coach-bubble",
    "screenId": "evening_opener",
    "context": "BEAT: Evening opener.\n\nSay the greeting and habits ask (the time clip plays in front). The habit checklist renders on screen.",
    "allowedTools": null,
    "expectedResponse": "User starts evening habit review or declines",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "text": "Hey, good evening. Here are your habits for today. How did the day go?"
    },
    "legacy": {
      "opener": "Hey, good evening. Here are your habits for today. How did the day go?",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Hey, good evening. Here are your habits for today. How did the day go?",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "evening_opener"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "evening-context-set-script",
          "rule": "Evening daily check-in uses fixed Cartesia TTS script, no improvised coach wording.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "evening-context-structured-forward",
          "rule": "The flow moves forward only: opener, habits, partial gate if needed, reflection, wrap.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "evening-opener-context-habits",
          "rule": "Greeting frames the habit review and does not start reflection yet.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        }
      ],
      "code": [
        {
          "id": "evening-opener-code-script",
          "rule": "The opener is a single script line.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "evening-opener-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "evening-opener-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "evening-habits",
    "name": "Evening habit review",
    "order": 39,
    "path": "both",
    "type": "habit-review",
    "screenId": "evening_habits",
    "context": "BEAT: Evening habits.\n\nThe user marks each habit done, not done, or pending, by tapping or saying it. Record completions with complete_habit, polarity aware: a 'do' habit counts when they did it, an 'avoid' habit counts only when they abstained, a slip is left unmarked, never a failure, never congratulated. If they marked it on the card, do not also call complete_habit. EXPLICIT REACTION: after they report, give ONE short live reaction to the day.",
    "allowedTools": "record_habit_review",
    "expectedResponse": "Marks each habit done, not done, or pending by voice or tap",
    "voiceEngine": "Silent",
    "voiceMode": null,
    "hideOrb": false,
    "props": null,
    "legacy": {
      "opener": null,
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": false,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Silent",
      "scripted": null,
      "narration": null,
      "elements": []
    },
    "script": [],
    "rules": {
      "context": [
        {
          "id": "evening-context-set-script",
          "rule": "Evening daily check-in uses fixed Cartesia TTS script, no improvised coach wording.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "evening-context-structured-forward",
          "rule": "The flow moves forward only: opener, habits, partial gate if needed, reflection, wrap.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "evening-habits-context-three-states",
          "rule": "Habit review supports done, not done, and pending without shame.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        }
      ],
      "code": [
        {
          "id": "evening-habits-code-record-tool",
          "rule": "The beat declares record_habit_review in allowedTools.",
          "severity": "must",
          "enforcedBy": "schema:BeatEntry"
        },
        {
          "id": "evening-habits-code-component",
          "rule": "The habit-review component renders in the flow build.",
          "severity": "must",
          "enforcedBy": "npm:build:flow"
        }
      ]
    }
  },
  {
    "id": "evening-are-you-done",
    "name": "Evening partial gate",
    "order": 40,
    "path": "both",
    "type": "coach-bubble",
    "screenId": "are_you_done",
    "context": "BEAT: Are you done (shared, morning and evening).\n\nOnly when a bounded step (the four morning items, or the evening habit list) is left partial. Say the are-you-done line ONCE. The user adds the rest or says they're done. Either way, move on. Never re-ask, never loop, never block. Governed by the Global are-you-done rule.",
    "allowedTools": null,
    "expectedResponse": "Adds remaining habit statuses or says done",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "text": "Looks like there are a few items left. Want to add anything, or should we move on?"
    },
    "legacy": {
      "opener": "Looks like there are a few items left. Want to add anything, or should we move on?",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Looks like there are a few items left. Want to add anything, or should we move on?",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "are_you_done"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null,
        "expectedUser": "User adds missing habit statuses or says done"
      }
    ],
    "rules": {
      "context": [
        {
          "id": "evening-context-set-script",
          "rule": "Evening daily check-in uses fixed Cartesia TTS script, no improvised coach wording.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "evening-context-structured-forward",
          "rule": "The flow moves forward only: opener, habits, partial gate if needed, reflection, wrap.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "evening-done-context-once",
          "rule": "Ask are you done only once when some habit statuses are skipped.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        }
      ],
      "code": [
        {
          "id": "evening-done-code-expected-user",
          "rule": "The script records the expected user continuation or done response.",
          "severity": "must",
          "enforcedBy": "schema:ScriptLine"
        },
        {
          "id": "evening-done-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "evening-done-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "evening-reflection-transition",
    "name": "Evening reflection transition",
    "order": 41,
    "path": "both",
    "type": "coach-bubble",
    "screenId": "reflection_transition",
    "context": "BEAT: Reflection transition.\n\nSay the transition line, then begin the reflection in the style the user saved: the three suggested questions, their own saved prompts, or freeform. Match their persisted template, do not assume the three.",
    "allowedTools": null,
    "expectedResponse": "Auto-advances into reflection questions",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "text": "Good. Now let's take a moment to reflect on the day itself."
    },
    "legacy": {
      "opener": "Good. Now let's take a moment to reflect on the day itself.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Good. Now let's take a moment to reflect on the day itself.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "reflection_transition"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "evening-context-set-script",
          "rule": "Evening daily check-in uses fixed Cartesia TTS script, no improvised coach wording.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "evening-context-structured-forward",
          "rule": "The flow moves forward only: opener, habits, partial gate if needed, reflection, wrap.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "evening-reflection-transition-context-bridge",
          "rule": "Transition moves from habits into reflection and does not summarize the day.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        }
      ],
      "code": [
        {
          "id": "evening-reflection-transition-code-script",
          "rule": "The transition is a single script line.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "evening-reflection-transition-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "evening-reflection-transition-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "evening-reflection",
    "name": "Evening reflection",
    "order": 42,
    "path": "both",
    "type": "reflection",
    "screenId": "reflection",
    "context": "BEAT: Reflection.\n\nThis follows the reflection template the user set up and SAVED in onboarding. Read their persisted reflection settings and go by that, exactly:\n- suggested template: ask the three, one at a time, in order: what am I proud of, what do I forgive myself for, what am I grateful for. Do not reorder.\n- your template: ask the user's own saved prompts, one at a time, in the order they saved them. Never fall back to the suggested three.\n- freeform: no prompts. Invite them to talk freely, then listen.\n\nAfter each answer, call log_reflection(text=the user's words, title=the prompt). Do not react between prompts. EXPLICIT REACTION: after the last answer, give ONE short live reaction to the whole reflection, gentle, reflect back what they shared, do not analyze or try to solve. For freeform, one gentle reaction to what they shared.",
    "allowedTools": "record_reflection",
    "expectedResponse": "Answers proud, forgive, and grateful prompts",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "proud": "What are you proud of today?",
      "proudAnswer": "I showed up even though I was tired.",
      "forgive": "What do you forgive yourself for today?",
      "forgiveAnswer": "Skipping my afternoon walk.",
      "grateful": "What are you grateful for today?",
      "gratefulAnswer": "A good talk with my brother."
    },
    "legacy": {
      "opener": "What are you proud of today?",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "What are you proud of today?",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "reflection"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null,
        "expectedUser": "User answers one thing they are proud of"
      },
      {
        "seq": 2,
        "words": "What do you forgive yourself for today?",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-2",
          "screen": "reflection"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null,
        "expectedUser": "User answers one thing they forgive themselves for"
      },
      {
        "seq": 3,
        "words": "What are you grateful for today?",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-3",
          "screen": "reflection"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null,
        "expectedUser": "User answers one thing they are grateful for"
      }
    ],
    "rules": {
      "context": [
        {
          "id": "evening-context-set-script",
          "rule": "Evening daily check-in uses fixed Cartesia TTS script, no improvised coach wording.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "evening-context-structured-forward",
          "rule": "The flow moves forward only: opener, habits, partial gate if needed, reflection, wrap.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "evening-reflection-context-three-prompts",
          "rule": "Reflection asks proud, forgive, and grateful in order.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        }
      ],
      "code": [
        {
          "id": "evening-reflection-code-record-tool",
          "rule": "The beat declares record_reflection in allowedTools.",
          "severity": "must",
          "enforcedBy": "schema:BeatEntry"
        },
        {
          "id": "evening-reflection-code-three-lines",
          "rule": "The script carries three reflection prompt lines.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "evening-reflection-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "evening-reflection-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "evening-wrap",
    "name": "Evening wrap",
    "order": 43,
    "path": "both",
    "type": "coach-bubble",
    "screenId": "evening_wrap",
    "context": "BEAT: Evening wrap.\n\nSay the wrap line, then end. Nothing after.",
    "allowedTools": null,
    "expectedResponse": "Auto-ends evening check-in",
    "voiceEngine": "Cartesia",
    "voiceMode": "Verbatim",
    "hideOrb": false,
    "props": {
      "text": "That's it for tonight. Sleep well."
    },
    "legacy": {
      "opener": "That's it for tonight. Sleep well.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": null,
      "engine": "Cartesia",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "That's it for tonight. Sleep well.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "evening_wrap"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "evening-context-set-script",
          "rule": "Evening daily check-in uses fixed Cartesia TTS script, no improvised coach wording.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "evening-context-structured-forward",
          "rule": "The flow moves forward only: opener, habits, partial gate if needed, reflection, wrap.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "evening-wrap-context-end",
          "rule": "Wrap line ends the evening check-in and adds nothing after it.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        }
      ],
      "code": [
        {
          "id": "evening-wrap-code-script",
          "rule": "The wrap is a single script line.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "evening-wrap-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "evening-wrap-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "the-weekly-frame",
    "name": "The Weekly frame",
    "order": 44,
    "path": "both",
    "type": "coach-bubble",
    "screenId": "WEEKLY-FRAME",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "User enters the weekly session after the daily reflection",
    "voiceEngine": "Vapi",
    "voiceMode": "Improvise",
    "hideOrb": false,
    "props": {
      "text": "Let's zoom out. A whole week of you to look at."
    },
    "legacy": {
      "opener": "Let's zoom out. A whole week of you to look at.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "Provisional wording from the-weekly.md",
      "engine": "Vapi",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Let's zoom out. A whole week of you to look at.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "WEEKLY-FRAME"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "the-weekly-context-generative",
          "rule": "The Weekly is generative and grounded in the real week, not a scripted daily check-in.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "the-weekly-context-no-shame",
          "rule": "Coach never shames missed habits and defaults to fewer, smaller, sustainable changes.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        }
      ],
      "code": [
        {
          "id": "the-weekly-code-vapi-mode",
          "rule": "The Weekly beats are tagged Vapi Improvise for the rich coaching session.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "the-weekly-code-tools-on-edit",
          "rule": "The brainstorm beat declares plan editing tools in allowedTools.",
          "severity": "must",
          "enforcedBy": "schema:BeatEntry"
        },
        {
          "id": "the-weekly-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "the-weekly-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "the-weekly-week-shown",
    "name": "The week shown",
    "order": 45,
    "path": "both",
    "type": "weekly-projection",
    "screenId": "WEEKLY-WEEK-SHOWN",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "User reviews the weekly grid and coach highlights",
    "voiceEngine": "Vapi",
    "voiceMode": "Improvise",
    "hideOrb": false,
    "props": {
      "state": "p78",
      "coachLine": "You showed up 5 of 7. Strong middle of the week."
    },
    "legacy": {
      "opener": "You showed up 5 of 7. Strong middle of the week.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "Example wording from the-weekly.md",
      "engine": "Vapi",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "You showed up 5 of 7. Strong middle of the week.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "WEEKLY-WEEK-SHOWN"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "the-weekly-context-generative",
          "rule": "The Weekly is generative and grounded in the real week, not a scripted daily check-in.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "the-weekly-context-no-shame",
          "rule": "Coach never shames missed habits and defaults to fewer, smaller, sustainable changes.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        }
      ],
      "code": [
        {
          "id": "the-weekly-code-vapi-mode",
          "rule": "The Weekly beats are tagged Vapi Improvise for the rich coaching session.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "the-weekly-code-tools-on-edit",
          "rule": "The brainstorm beat declares plan editing tools in allowedTools.",
          "severity": "must",
          "enforcedBy": "schema:BeatEntry"
        },
        {
          "id": "the-weekly-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "the-weekly-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "the-weekly-insights",
    "name": "Weekly insights",
    "order": 46,
    "path": "both",
    "type": "live-reaction",
    "screenId": "WEEKLY-INSIGHTS",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "User hears one or two grounded patterns",
    "voiceEngine": "Vapi",
    "voiceMode": "Improvise",
    "hideOrb": false,
    "props": {
      "text": "Your energy tracked your sleep almost exactly. The days you moved, your mood was up."
    },
    "legacy": {
      "opener": "Your energy tracked your sleep almost exactly. The days you moved, your mood was up.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "Example wording from the-weekly.md",
      "engine": "Vapi",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Your energy tracked your sleep almost exactly. The days you moved, your mood was up.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "WEEKLY-INSIGHTS"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "the-weekly-context-generative",
          "rule": "The Weekly is generative and grounded in the real week, not a scripted daily check-in.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "the-weekly-context-no-shame",
          "rule": "Coach never shames missed habits and defaults to fewer, smaller, sustainable changes.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        }
      ],
      "code": [
        {
          "id": "the-weekly-code-vapi-mode",
          "rule": "The Weekly beats are tagged Vapi Improvise for the rich coaching session.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "the-weekly-code-tools-on-edit",
          "rule": "The brainstorm beat declares plan editing tools in allowedTools.",
          "severity": "must",
          "enforcedBy": "schema:BeatEntry"
        },
        {
          "id": "the-weekly-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "the-weekly-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "the-weekly-brainstorm-edit",
    "name": "Weekly brainstorm and edit",
    "order": 47,
    "path": "both",
    "type": "coach-bubble",
    "screenId": "WEEKLY-BRAINSTORM-EDIT",
    "context": null,
    "allowedTools": "add_habit, remove_habit, reschedule_habit, update_habit, set_weekly_focus",
    "expectedResponse": "User decides whether to add, drop, shrink, reschedule, or keep the plan",
    "voiceEngine": "Vapi",
    "voiceMode": "Improvise",
    "hideOrb": false,
    "props": {
      "text": "What feels worth changing for next week?"
    },
    "legacy": {
      "opener": "What feels worth changing for next week?",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "Provisional structure, final weekly copy not locked",
      "engine": "Vapi",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "What feels worth changing for next week?",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "WEEKLY-BRAINSTORM-EDIT"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null,
        "expectedUser": "User discusses plan edits or keeps the plan"
      }
    ],
    "rules": {
      "context": [
        {
          "id": "the-weekly-context-generative",
          "rule": "The Weekly is generative and grounded in the real week, not a scripted daily check-in.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "the-weekly-context-no-shame",
          "rule": "Coach never shames missed habits and defaults to fewer, smaller, sustainable changes.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        }
      ],
      "code": [
        {
          "id": "the-weekly-code-vapi-mode",
          "rule": "The Weekly beats are tagged Vapi Improvise for the rich coaching session.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "the-weekly-code-tools-on-edit",
          "rule": "The brainstorm beat declares plan editing tools in allowedTools.",
          "severity": "must",
          "enforcedBy": "schema:BeatEntry"
        },
        {
          "id": "the-weekly-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "the-weekly-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "the-weekly-close",
    "name": "The Weekly close",
    "order": 48,
    "path": "both",
    "type": "coach-bubble",
    "screenId": "WEEKLY-CLOSE",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "Auto-ends The Weekly",
    "voiceEngine": "Vapi",
    "voiceMode": "Improvise",
    "hideOrb": false,
    "props": {
      "text": "Same plan, one change. Good week."
    },
    "legacy": {
      "opener": "Same plan, one change. Good week.",
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "Provisional wording from the-weekly.md",
      "engine": "Vapi",
      "scripted": true,
      "narration": null,
      "elements": []
    },
    "script": [
      {
        "seq": 1,
        "words": "Same plan, one change. Good week.",
        "bindsTo": {
          "kind": "bubble",
          "element": "bubble-1",
          "screen": "WEEKLY-CLOSE"
        },
        "voice": "cartesia",
        "clip": null,
        "clipPath": null
      }
    ],
    "rules": {
      "context": [
        {
          "id": "the-weekly-context-generative",
          "rule": "The Weekly is generative and grounded in the real week, not a scripted daily check-in.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        },
        {
          "id": "the-weekly-context-no-shame",
          "rule": "Coach never shames missed habits and defaults to fewer, smaller, sustainable changes.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        }
      ],
      "code": [
        {
          "id": "the-weekly-code-vapi-mode",
          "rule": "The Weekly beats are tagged Vapi Improvise for the rich coaching session.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "the-weekly-code-tools-on-edit",
          "rule": "The brainstorm beat declares plan editing tools in allowedTools.",
          "severity": "must",
          "enforcedBy": "schema:BeatEntry"
        },
        {
          "id": "the-weekly-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "the-weekly-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "library-browse",
    "name": "Library browse",
    "order": 49,
    "path": "both",
    "type": "reset-library",
    "screenId": "LIBRARY-BROWSE",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "User chooses a reset track",
    "voiceEngine": "Silent",
    "voiceMode": null,
    "hideOrb": false,
    "props": {
      "stage": "browse"
    },
    "legacy": {
      "opener": null,
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "Coach lines and per-track whatFor copy pending Yair",
      "engine": "Silent",
      "scripted": null,
      "narration": null,
      "elements": []
    },
    "script": [],
    "rules": {
      "context": [
        {
          "id": "library-context-structure-only",
          "rule": "Library beats are structure only until Yair writes coach lines and per-track whatFor copy.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        },
        {
          "id": "library-context-reset-not-focus",
          "rule": "The tab label is Reset and the collection name shown inside the page is The Return.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        }
      ],
      "code": [
        {
          "id": "library-code-silent-until-copy",
          "rule": "Library structure beats stay Silent and carry no script lines until copy is approved.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "library-code-component",
          "rule": "The reset-library component renders browse, player, and nudge stages in the flow build.",
          "severity": "must",
          "enforcedBy": "npm:build:flow"
        },
        {
          "id": "library-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "library-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "library-player",
    "name": "Library player",
    "order": 50,
    "path": "both",
    "type": "reset-library",
    "screenId": "LIBRARY-PLAYER",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "User starts, pauses, seeks, or exits the selected track",
    "voiceEngine": "Silent",
    "voiceMode": null,
    "hideOrb": false,
    "props": {
      "stage": "player"
    },
    "legacy": {
      "opener": null,
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "Player structure only, coach intro copy pending Yair",
      "engine": "Silent",
      "scripted": null,
      "narration": null,
      "elements": []
    },
    "script": [],
    "rules": {
      "context": [
        {
          "id": "library-context-structure-only",
          "rule": "Library beats are structure only until Yair writes coach lines and per-track whatFor copy.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        },
        {
          "id": "library-context-reset-not-focus",
          "rule": "The tab label is Reset and the collection name shown inside the page is The Return.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        }
      ],
      "code": [
        {
          "id": "library-code-silent-until-copy",
          "rule": "Library structure beats stay Silent and carry no script lines until copy is approved.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "library-code-component",
          "rule": "The reset-library component renders browse, player, and nudge stages in the flow build.",
          "severity": "must",
          "enforcedBy": "npm:build:flow"
        },
        {
          "id": "library-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "library-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  },
  {
    "id": "library-nudges",
    "name": "Library reset nudges",
    "order": 51,
    "path": "both",
    "type": "reset-library",
    "screenId": "LIBRARY-NUDGES",
    "context": null,
    "allowedTools": null,
    "expectedResponse": "User configures reset nudge slots and track choice",
    "voiceEngine": "Silent",
    "voiceMode": null,
    "hideOrb": false,
    "props": {
      "stage": "nudges"
    },
    "legacy": {
      "opener": null,
      "secondBubble": null,
      "closeBubble": null,
      "confirmBubble": null,
      "buttonLabel": null,
      "openerMode": null,
      "openerShowsAsBubble": true,
      "variable": false,
      "variableNote": null,
      "clipNote": "Notification UI structure only, nudge copy belongs in the Sheet",
      "engine": "Silent",
      "scripted": null,
      "narration": null,
      "elements": []
    },
    "script": [],
    "rules": {
      "context": [
        {
          "id": "library-context-structure-only",
          "rule": "Library beats are structure only until Yair writes coach lines and per-track whatFor copy.",
          "severity": "must",
          "enforcedBy": "prose-only-accepted"
        },
        {
          "id": "library-context-reset-not-focus",
          "rule": "The tab label is Reset and the collection name shown inside the page is The Return.",
          "severity": "must",
          "enforcedBy": "parity-walk"
        }
      ],
      "code": [
        {
          "id": "library-code-silent-until-copy",
          "rule": "Library structure beats stay Silent and carry no script lines until copy is approved.",
          "severity": "must",
          "enforcedBy": "scripts/render-consistency-check.mjs"
        },
        {
          "id": "library-code-component",
          "rule": "The reset-library component renders browse, player, and nudge stages in the flow build.",
          "severity": "must",
          "enforcedBy": "npm:build:flow"
        },
        {
          "id": "library-code-script-bindings-resolve",
          "rule": "Script lines bind only to structural tokens or declared component elements.",
          "severity": "must",
          "enforcedBy": "scripts/render-link-integrity-check.mjs"
        },
        {
          "id": "library-code-rules-self-audit",
          "rule": "Every code rule names a real guard, test, schema, or package script.",
          "severity": "must",
          "enforcedBy": "scripts/render-rules-check.mjs"
        }
      ]
    }
  }
] as const;

export const BEAT_BY_ID: Record<string, BeatEntry> = Object.fromEntries(
  BEATS_SOURCE.map((b) => [b.id, b]),
);
export const BEAT_BY_SCREEN_ID: Record<string, BeatEntry> = Object.fromEntries(
  BEATS_SOURCE.filter((b) => b.screenId).map((b) => [b.screenId as string, b]),
);
