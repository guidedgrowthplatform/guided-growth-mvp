// GENERATED from the Master Sheet "Beats Context" + "Beat Elements" tabs.
// Regenerate: python3 scripts/voice-sync/gen_beat_metadata.py
// Per-onboarding-beat authoring metadata, keyed by beat id. Merged into each
// beat's meta on hydrate (withBeatMeta). Wording is provisional; wire against the
// engine, flags, elementIds, and order. showsAsBubble false = spoken, component
// carries the words (no chat bubble). openerMode A = no framing opener (control
// lines lead); B = keep the framing opener then the control lines.
export interface BeatElementLine {
  readonly elementId: string;
  readonly line: string;
  readonly order: number;
  readonly showsAsBubble: boolean;
}
export interface BeatContextMeta {
  readonly voiceEngine?: string;
  readonly voiceMode?: string;
  readonly spokenContent?: string;
  readonly allowedTools?: string;
  readonly variable?: boolean;
  readonly openerMode?: 'A' | 'B';
  readonly openerShowsAsBubble?: boolean;
  readonly expectedResponse?: string;
  readonly perElement?: readonly BeatElementLine[];
}
export const BEAT_METADATA: Record<string, BeatContextMeta> = {
  'onboarding-advanced-beat-15-capture-existing-habits': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent:
      'Read me the habits you already track. Less is more to start, you can always build on it.',
    allowedTools: 'submit_brain_dump, advance_step',
    openerShowsAsBubble: true,
    expectedResponse: 'Reads or types their habits',
  },
  'onboarding-advanced-beat-16-schedule-existing-habits': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent: "Now the days. Tell me how often each one runs and I'll fill them in.",
    allowedTools: 'add_habit, update_habit, advance_step',
    openerShowsAsBubble: true,
    expectedResponse: 'Says the days per habit',
  },
  'onboarding-beat-10-experience-fork': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent:
      "For the next part of the process, I'd like to know: Do you already track habits or is this new to you?",
    allowedTools: 'submit_path_choice, ask_clarification, advance_step',
    openerShowsAsBubble: true,
    expectedResponse: 'New, or I already track habits',
  },
  'onboarding-beat-17-plan-review': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent:
      "Here's your plan. Your check-in, your reflection, and the habits you picked. Want to start here, or change anything first?",
    allowedTools: 'update_habit, confirm_plan',
    openerShowsAsBubble: true,
    expectedResponse: 'Looks good, or an edit',
  },
  'onboarding-beat-18-week-projection:avoid': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent:
      'The one thing we want to avoid is this. The empty days you never reported. Stay consistent, just report it. Even a miss counts, that keeps us going.',
    openerShowsAsBubble: false,
    expectedResponse: 'Taps Next',
  },
  'onboarding-beat-18-week-projection:best': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent: 'Best case, every day green. Every streak going strong. That would be amazing.',
    openerShowsAsBubble: false,
    expectedResponse: 'Taps Next',
  },
  'onboarding-beat-18-week-projection:empty': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent: 'This is your week. Blank, starting today.',
    openerShowsAsBubble: false,
    expectedResponse: 'Taps Next',
  },
  'onboarding-beat-18-week-projection:likely': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent:
      "More likely, you land around here. Mostly green, a few misses, your streaks holding. That's a real win.",
    openerShowsAsBubble: false,
    expectedResponse: 'Taps Next',
  },
  'onboarding-beat-18-week-projection:some': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent:
      "Some weeks land here. One streak survives, the rest take a hit. Still fine, you're building. We reassess.",
    openerShowsAsBubble: false,
    expectedResponse: 'Taps Next',
  },
  'onboarding-beat-3-coach-greeting': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent:
      "Hey. I'm your coach inside Guided Growth. Give me two minutes and we'll set up something that actually sticks.",
    openerShowsAsBubble: false,
    expectedResponse: 'Auto-advances',
  },
  'onboarding-beat-4-sign-up': {
    voiceEngine: 'None',
    openerShowsAsBubble: false,
    expectedResponse: 'Taps Apple, Google, or email sign-in',
  },
  'onboarding-beat-5-mic-permission': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent:
      "I'd love to actually talk with you. If you let me use your mic, you can just speak.",
    openerShowsAsBubble: false,
    expectedResponse: 'Taps Allow or Not now',
  },
  'onboarding-beat-6-profile:greeting': {
    voiceEngine: 'Cartesia',
    voiceMode: 'Verbatim',
    spokenContent:
      'Good to meet you, {name}. Two quick things so I can tailor this to you. How old are you?',
    allowedTools: 'submit_profile, advance_step',
    variable: true,
    openerShowsAsBubble: true,
    expectedResponse: 'Says or taps age and gender',
  },
  'onboarding-beat-7-state-check': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent:
      "Let's do your first check-in right now. How are you landing in this moment? Mood, energy, sleep, anything on you.",
    allowedTools: 'record_checkin, advance_step',
    openerShowsAsBubble: true,
    expectedResponse: 'Taps or says sleep, mood, energy, stress',
    perElement: [
      { elementId: 'sleep', line: 'How did you sleep?', order: 1, showsAsBubble: false },
      { elementId: 'mood', line: "How's your mood?", order: 2, showsAsBubble: false },
      { elementId: 'energy', line: "How's your energy?", order: 3, showsAsBubble: false },
      { elementId: 'stress', line: 'And your stress?', order: 4, showsAsBubble: false },
    ],
  },
  'onboarding-beat-8-morning-checkin-setup': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    openerMode: 'A',
    allowedTools: 'submit_morning_checkin, advance_step',
    openerShowsAsBubble: false,
    expectedResponse: 'Sets a time and days',
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
  'onboarding-beat-9-evening-reflection-setup': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent:
      'One more. An evening reflection, a couple of minutes to close the day. How do you want to do it, and when?',
    openerMode: 'B',
    allowedTools: 'submit_reflection_config, submit_custom_prompts, advance_step',
    openerShowsAsBubble: true,
    expectedResponse: 'Picks a style and time',
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
  'onboarding-beginner-beat-11-pick-category': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent:
      "Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.",
    allowedTools: 'submit_category, advance_step',
    openerShowsAsBubble: true,
    expectedResponse: 'Names or picks one category',
  },
  'onboarding-beginner-beat-12-pick-goals': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent: "Within that, what's the piece you want to start with?",
    allowedTools: 'submit_goals, advance_step',
    openerShowsAsBubble: true,
    expectedResponse: 'Names or taps 1 to 2 goals',
  },
  'onboarding-beginner-beat-13-pick-habits': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    spokenContent:
      "Pick the habits that feel doable. Not impressive, just doable. One you'll actually keep beats five you won't. Make your own if nothing here fits.",
    allowedTools: 'add_habit, remove_habit, advance_step',
    openerShowsAsBubble: true,
    expectedResponse: 'Names or taps 1 to 2 habits',
  },
  'onboarding-beginner-beat-14-schedule-habits': {
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    openerMode: 'A',
    allowedTools: 'add_habit, update_habit, advance_step',
    openerShowsAsBubble: false,
    expectedResponse: 'Sets days and time per habit',
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
};
