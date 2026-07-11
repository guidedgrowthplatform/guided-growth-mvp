// GENERATED from the Master Sheet "Beats Context" + "Beat Elements" tabs, for
// fields the render (beatsSource.ts) does not yet model at this granularity.
// Regenerate: python3 scripts/voice-sync/gen_beat_metadata.py
//
// This file used to also carry voiceEngine, voiceMode, allowedTools, and
// expectedResponse. Those are BEHAVIORAL facts that beatsSource.ts (the render,
// "THE ONE SOURCE") already owns per beat (BeatEntry.voiceEngine/voiceMode/
// allowedTools/expectedResponse, looked up via BEAT_BY_SCREEN_ID). A live audit
// (gg-spec/docs/whole-system-onboarding-qa-2026-07-10.md, finding B5) found this
// file's Sheet-synced copies of those fields could silently diverge from the
// render's, since no check compared them. FlowBuilder.tsx (withBeatMeta) now
// reads those four fields directly from beatsSource.ts instead of from this
// file, so they can no longer be a second source: see withRenderFacts in
// FlowBuilder.tsx. gen_beat_metadata.py no longer emits them (2026-07-10).
//
// What's left here is authoring content the render does not carry at all: the
// FlowBuilder tool's per-instance opener seed text (spokenContent), the
// per-form-field micro-lines (perElement, at finer grain than beatsSource's
// script[]), and two presentation flags (openerMode, openerShowsAsBubble) with
// no beatsSource equivalent. Per-onboarding-beat authoring metadata, keyed by
// screen_id. Merged into each beat's meta on hydrate (withBeatMeta). Wording is
// provisional; wire against the flags, elementIds, and order. showsAsBubble
// false = spoken, component carries the words (no chat bubble). openerMode A =
// no framing opener (control lines lead); B = keep the framing opener then the
// control lines.
//
// scripts/beat-metadata-reconcile-check.mjs (wired into check:beats) fails if
// this file's screen_ids drift from beatsSource.ts's, or if a retired
// behavioral field listed above reappears here.
export interface BeatElementLine {
  readonly elementId: string;
  readonly line: string;
  readonly order: number;
  readonly showsAsBubble: boolean;
}
export interface BeatContextMeta {
  readonly spokenContent?: string;
  readonly variable?: boolean;
  readonly openerMode?: 'A' | 'B';
  readonly openerShowsAsBubble?: boolean;
  readonly perElement?: readonly BeatElementLine[];
}
export const BEAT_METADATA: Record<string, BeatContextMeta> = {
  'COACH-GREETING': {
    spokenContent:
      "Hey. I'm your coach inside Guided Growth. Give me two minutes and we'll set up something that actually sticks.",
    openerShowsAsBubble: false,
  },
  'MIC-PERMISSION': {
    spokenContent:
      "I'd love to actually talk with you. If you let me use your mic, you can just speak.",
    openerShowsAsBubble: false,
  },
  'ONBOARD-01--FORM': {
    spokenContent:
      'Good to meet you, {name}. Two quick things so I can tailor this to you. How old are you?',
    variable: true,
    openerShowsAsBubble: true,
  },
  'ONBOARD-ADVANCED': {
    spokenContent:
      'Read me the habits you already track. Less is more to start, you can always build on it.',
    openerShowsAsBubble: true,
  },
  'ONBOARD-ADVANCED-FREQUENCY': {
    spokenContent: "Now the days. Tell me how often each one runs and I'll fill them in.",
    openerShowsAsBubble: true,
  },
  'ONBOARD-AUTH--FORM': { openerShowsAsBubble: false },
  'ONBOARD-BEGINNER-01': {
    spokenContent:
      "Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.",
    openerShowsAsBubble: true,
  },
  'ONBOARD-BEGINNER-02': {
    spokenContent: "Within that, what's the piece you want to start with?",
    openerShowsAsBubble: true,
  },
  'ONBOARD-BEGINNER-03': {
    spokenContent:
      "Pick the habits that feel doable. Not impressive, just doable. One you'll actually keep beats five you won't. Make your own if nothing here fits.",
    openerShowsAsBubble: true,
  },
  'ONBOARD-BEGINNER-04': {
    openerMode: 'A',
    openerShowsAsBubble: false,
    perElement: [
      {
        elementId: 'schedule',
        line: 'Weekdays, weekends, or every day?',
        order: 1,
        showsAsBubble: false,
      },
      { elementId: 'when', line: 'What time?', order: 2, showsAsBubble: false },
      { elementId: 'how-often', line: 'Or your own days.', order: 3, showsAsBubble: false },
      { elementId: 'reminder', line: 'Want a reminder?', order: 4, showsAsBubble: false },
    ],
  },
  'ONBOARD-BEGINNER-07': {
    spokenContent:
      'One more. An evening reflection, a minute and a half to close the day. How do you want to do it, and when?',
    openerMode: 'B',
    openerShowsAsBubble: true,
    perElement: [
      {
        elementId: 'prompts',
        line: 'Three questions to close the day.',
        order: 1,
        showsAsBubble: false,
      },
      { elementId: 'mode', line: 'Or freeform, just talk.', order: 2, showsAsBubble: false },
      {
        elementId: 'schedule',
        line: 'Weekdays, weekends, or every day?',
        order: 3,
        showsAsBubble: false,
      },
      { elementId: 'when', line: 'What time?', order: 4, showsAsBubble: false },
      { elementId: 'how-often', line: 'Or your own days.', order: 5, showsAsBubble: false },
      { elementId: 'reminder', line: 'Want a reminder?', order: 6, showsAsBubble: false },
    ],
  },
  'ONBOARD-COMPLETE': {
    spokenContent:
      "Here's your plan. Your check-in, your reflection, and the habits you picked. Want to start here, or change anything first?",
    openerShowsAsBubble: true,
  },
  'ONBOARD-FORK--FORM': {
    spokenContent:
      'One more question before we set up your habits. Do you already track habits or is this new to you?',
    openerShowsAsBubble: true,
  },
  'ONBOARD-MORNING-SETUP': {
    openerMode: 'A',
    openerShowsAsBubble: false,
    perElement: [
      {
        elementId: 'schedule',
        line: 'Weekdays, weekends, or every day?',
        order: 1,
        showsAsBubble: false,
      },
      { elementId: 'when', line: 'What time?', order: 2, showsAsBubble: false },
      { elementId: 'how-often', line: 'Or your own days.', order: 3, showsAsBubble: false },
      {
        elementId: 'reminder',
        line: "Want a reminder when it's time?",
        order: 4,
        showsAsBubble: false,
      },
    ],
  },
  'ONBOARD-STATE-CHECK': {
    spokenContent:
      "Let's do your first check-in right now. How are you landing in this moment? Mood, energy, sleep, anything on you.",
    openerShowsAsBubble: true,
    perElement: [
      { elementId: 'sleep', line: 'How did you sleep?', order: 1, showsAsBubble: false },
      { elementId: 'mood', line: "How's your mood?", order: 2, showsAsBubble: false },
      { elementId: 'energy', line: "How's your energy?", order: 3, showsAsBubble: false },
      { elementId: 'stress', line: 'And your stress?', order: 4, showsAsBubble: false },
    ],
  },
  'ONBOARD-WEEKLY-PROJECTION-BLANK': {
    spokenContent: 'This is your week. Blank, starting today.',
    openerShowsAsBubble: false,
  },
  'ONBOARD-WEEKLY-PROJECTION-FULL': {
    spokenContent: 'Best case, every day green. Every streak going strong. That would be amazing.',
    openerShowsAsBubble: false,
  },
  'ONBOARD-WEEKLY-PROJECTION-GAPS': {
    spokenContent:
      'The one thing we want to avoid is this. The empty days you never reported. Stay consistent, just report it. Even a miss counts, that keeps us going.',
    openerShowsAsBubble: false,
  },
  'ONBOARD-WEEKLY-PROJECTION-P36': {
    spokenContent:
      "Some weeks land here. One streak survives, the rest take a hit. Still fine, you're building. We reassess.",
    openerShowsAsBubble: false,
  },
  'ONBOARD-WEEKLY-PROJECTION-P78': {
    spokenContent:
      "More likely, you land around here. Mostly green, a few misses, your streaks holding. That's a real win.",
    openerShowsAsBubble: false,
  },
  'ONBOARD-WHY-INTRO': {
    spokenContent:
      "Here's the idea. The first habit isn't a workout or a diet. It's just checking in with yourself. It takes a minute, and it changes everything else. Let's start yours right now.",
    openerShowsAsBubble: false,
  },
};
