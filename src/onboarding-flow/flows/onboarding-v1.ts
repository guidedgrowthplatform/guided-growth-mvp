/**
 * Onboarding flow v1, authored to the flow-builder export spec
 * (gg-spec/docs/flow-builder-export-spec.md). This is the static, committed
 * source of truth for the engine today; see ../useFlow.ts for the Supabase
 * swap seam.
 *
 * Resynced to the flow builder's DEFAULT_FLOW on 2026-06-26: the beginner lane
 * runs category -> goals -> habit-select -> habit-schedule, the advanced lane is
 * the single advanced-capture brain-dump beat, both rejoin at plan-review, and
 * the shared tail continues plan-review -> morning-checkin-setup ->
 * reflection-setup (evening) -> into-app (the terminal completion beat).
 *
 * This must deep-equal designerToFlowDocument(DESIGNER_ONBOARDING_FLOW); the
 * transform test trips if the two ever diverge.
 */
import type { FlowDocument } from '../types';

export const onboardingV1: FlowDocument = {
  flowId: 'onboarding-v1',
  name: 'Beginner Onboarding',
  version: 1,
  publishedAt: '2026-06-23T00:00:00Z',
  // The engine owns the full chat onboarding, auth as beat 0. The coach copy,
  // openers, and allowed tools per beat live in beatContexts.ts (Global + Beat),
  // keyed by screenId. The fields here are orchestration only (order, fork,
  // component, persist); the inline `context`/`voice` are vestigial pointers.
  entryNodeId: 'auth',
  nodes: [
    {
      id: 'auth',
      type: 'beat',
      beatNumber: 0,
      name: 'Auth',
      screenId: 'ONBOARD-AUTH--FORM',
      nextId: 'mic',
      backId: null,
      context: {
        screenId: 'ONBOARD-AUTH--FORM',
        screenName: 'Auth',
        contextBlock:
          'Sign-in beat; captures the user name. Coach stays silent (see beatContexts).',
      },
      componentType: 'auth',
      componentProps: {},
      voice: { openerText: null, expectsInput: false, directLlmAllowed: false },
      tool: null,
      persist: null,
    },
    {
      // Designer beat 5, mic permission. A coach-led permission gate, NOT a save
      // step: the result is written to preferences (mic_permission/mic_enabled),
      // not onboarding_states, so persist + tool are null and there is no server
      // step (stepForScreenId('MIC-PERMISSION') is undefined). Vapi-only path
      // (directLlmAllowed false), like the routed MicPermissionPage.
      id: 'mic',
      type: 'beat',
      beatNumber: 0,
      name: 'Mic Permission',
      screenId: 'MIC-PERMISSION',
      nextId: 'profile',
      backId: null,
      context: {
        screenId: 'MIC-PERMISSION',
        screenName: 'Mic Permission',
        contextBlock:
          'Ask permission to use the microphone so the user can talk out loud. If they allow, continue warmly. If not now, continue without pushing.',
      },
      componentType: 'mic-permission',
      componentProps: {
        heading: 'Allow your microphone',
        sub: 'So you can talk with your coach out loud.',
        allowLabel: 'Allow microphone',
        skipLabel: 'Not now',
      },
      voice: {
        openerText: 'Allow your microphone so you can talk with your coach out loud.',
        expectsInput: false,
        directLlmAllowed: false,
      },
      tool: null,
      persist: null,
    },
    {
      id: 'profile',
      type: 'beat',
      beatNumber: 1,
      name: 'Profile',
      screenId: 'ONBOARD-01--FORM',
      nextId: 'path-fork',
      backId: 'mic',
      context: {
        screenId: 'ONBOARD-01--FORM',
        screenName: 'Profile',
        contextBlock: 'Profile beat: age + gender only. Name comes from auth (see beatContexts).',
      },
      componentType: 'profile-input',
      componentProps: {
        fields: ['age', 'gender'],
        genderOptions: ['Male', 'Female', 'Other'],
        ageRange: { min: 13, max: 120 },
      },
      // Display copy; the canonical spoken opener is beatContexts['ONBOARD-01--FORM'].opener.
      // {name} is substituted from answers.nickname by applyName at render time.
      voice: {
        openerText:
          "Awesome {name}, two quick things so I can tailor this to you. How old are you? And what's your gender?",
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: {
        toolName: 'submit_profile',
        persistsFields: ['age', 'gender', 'nickname'],
        advancesStep: true,
      },
      persist: { step: 1 },
    },
    {
      id: 'path-fork',
      type: 'branch',
      name: 'Path Fork',
      screenId: 'ONBOARD-FORK--FORM',
      condition: { source: 'answers.path', type: 'enum-match' },
      lanes: [
        {
          value: 'simple',
          label: 'Beginner',
          entryNodeId: 'category',
          exitNodeId: 'habit-schedule',
        },
        {
          value: 'braindump',
          label: 'Advanced',
          entryNodeId: 'advanced-input',
          exitNodeId: 'advanced-input',
        },
      ],
      mergeNodeId: 'plan-review',
      context: {
        screenId: 'ONBOARD-FORK--FORM',
        screenName: 'Path Choice',
        contextBlock:
          'Ask how they like to work: you can guide them step by step, or they can tell you everything on their mind and you organize it. Record their choice and continue. Do not explain the difference unless they ask.',
      },
      componentType: 'path-selection',
      componentProps: {
        bindsTo: 'path',
        options: [
          {
            value: 'simple',
            label: "I'm new to habit tracking",
            description: "I'll help you step by step",
          },
          {
            value: 'braindump',
            label: 'I already have experience',
            description: "Tell me your habits and I'll organize them",
          },
        ],
      },
      voice: {
        openerText: 'Have you tracked habits before, or is this new for you?',
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: { toolName: 'submit_path_choice', persistsFields: ['path'], advancesStep: false },
      persist: { step: 2, pathField: true },
    },
    {
      id: 'category',
      type: 'beat',
      beatNumber: 4,
      name: 'Focus Area',
      screenId: 'ONBOARD-BEGINNER-01',
      nextId: 'goals',
      backId: 'path-fork',
      context: {
        screenId: 'ONBOARD-BEGINNER-01',
        screenName: 'Focus Area',
        contextBlock:
          'The user picks one life area to focus on first. React to the one they choose, specifically. Do not pick for them.',
      },
      componentType: 'category-grid',
      componentProps: { maxSelections: 1, optionSource: 'categories' },
      voice: {
        openerText: 'What part of your life do you most want to grow right now?',
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: { toolName: 'submit_category', persistsFields: ['category'], advancesStep: true },
      persist: { step: 3 },
    },
    {
      id: 'goals',
      type: 'beat',
      beatNumber: 5,
      name: 'Goals',
      screenId: 'ONBOARD-BEGINNER-02',
      nextId: 'habit-select',
      backId: 'category',
      context: {
        screenId: 'ONBOARD-BEGINNER-02',
        screenName: 'Goals',
        contextBlock:
          'Narrow the focus area into one or two specific goals. Keep it to two at most so they are not overwhelmed.',
      },
      componentType: 'goals-list',
      componentProps: { maxSelections: 2, optionSource: 'goalsByCategory' },
      voice: {
        openerText: 'Which of these feels most true for you?',
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: { toolName: 'submit_goals', persistsFields: ['goals'], advancesStep: true },
      persist: { step: 4 },
    },
    {
      id: 'habit-select',
      type: 'beat',
      beatNumber: 6,
      name: 'Habit Selection',
      screenId: 'ONBOARD-BEGINNER-03',
      nextId: 'habit-schedule',
      backId: 'goals',
      context: {
        screenId: 'ONBOARD-BEGINNER-03',
        screenName: 'Habit Selection',
        contextBlock:
          'Help them pick up to two small daily habits to start with. Small and doable beats ambitious. They can always add more later.',
      },
      componentType: 'habit-picker',
      componentProps: { maxPerGoal: 2, optionSource: 'habitsByGoal' },
      voice: {
        openerText: "Here are a few habits that fit. Pick the ones you'll actually do.",
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: { toolName: 'add_habit', persistsFields: ['habits'], advancesStep: false },
      persist: { step: 5 },
    },
    {
      id: 'habit-schedule',
      type: 'beat',
      beatNumber: 7,
      name: 'Habit Schedule',
      screenId: 'ONBOARD-BEGINNER-04',
      nextId: 'plan-review',
      backId: 'habit-select',
      context: {
        screenId: 'ONBOARD-BEGINNER-04',
        screenName: 'Habit Schedule',
        contextBlock:
          'For each habit they chose, set when they will do it: a time, which days, and whether they want a reminder. Parse combined answers when you can. Ask only for the piece that is missing.',
      },
      componentType: 'habit-schedule',
      componentProps: { showDayPicker: true, showReminderToggle: true },
      voice: {
        openerText: 'When will you do these? Set a time and how often.',
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: { toolName: 'update_habit', persistsFields: ['habitConfigs'], advancesStep: true },
      persist: { step: 5 },
    },
    {
      // Minimal advanced lane: one brain-dump beat that rejoins at plan-review.
      // The rich 4-screen advanced lane (LLM parse -> results -> edit) is a
      // documented follow-up (spec section 6.5).
      id: 'advanced-input',
      type: 'beat',
      beatNumber: 4,
      name: 'Brain Dump (Advanced)',
      screenId: 'ONBOARD-ADVANCED',
      nextId: 'plan-review',
      backId: 'path-fork',
      context: {
        screenId: 'ONBOARD-ADVANCED',
        screenName: 'Brain Dump',
        contextBlock:
          'The user wants to tell you everything on their mind at once. Let them. Listen for the habits and goals inside it; do not interrupt with structure yet.',
      },
      componentType: 'advanced-capture',
      componentProps: {
        brainDump: true,
        placeholder: 'Tell me everything on your mind, what you want to build, drop, or change.',
      },
      voice: {
        openerText: "Perfect. Read me the habits you already track and I'll get them organized.",
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: {
        toolName: 'submit_brain_dump',
        persistsFields: ['brainDumpText'],
        advancesStep: true,
      },
      persist: { step: 3 },
    },
    {
      id: 'plan-review',
      type: 'beat',
      beatNumber: 8,
      name: 'Plan Review',
      screenId: 'ONBOARD-BEGINNER-06',
      nextId: 'morning-checkin-setup',
      backId: 'habit-schedule',
      context: {
        screenId: 'ONBOARD-BEGINNER-06',
        screenName: 'Plan Review',
        contextBlock:
          'Show them the habits you built together and ask if they want to change anything before moving on. Handle one edit at a time, then continue.',
      },
      componentType: 'plan-cards',
      componentProps: { showJournalCard: true },
      voice: {
        openerText: 'Here are your habits. Do these look right, or want to change anything?',
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: { toolName: 'update_habit', persistsFields: [], advancesStep: true },
      persist: null,
    },
    {
      id: 'morning-checkin-setup',
      type: 'beat',
      beatNumber: 9,
      name: 'Morning Check-in',
      screenId: 'ONBOARD-MORNING-SETUP',
      nextId: 'reflection-setup',
      backId: 'plan-review',
      context: {
        screenId: 'ONBOARD-MORNING-SETUP',
        screenName: 'Morning Check-in',
        contextBlock:
          'Set up a short morning check-in: when they want the nudge, which days, and whether they want a reminder. Keep it light, a quick way to start the day with intention.',
      },
      componentType: 'morning-checkin-setup',
      componentProps: { showDayPicker: true, showReminderToggle: true },
      voice: {
        openerText: "When do you want your morning check-in? I'll nudge you then.",
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: {
        toolName: 'submit_morning_checkin',
        persistsFields: ['morningCheckin'],
        advancesStep: true,
      },
      persist: { step: 7 },
    },
    {
      id: 'reflection-setup',
      type: 'beat',
      beatNumber: 10,
      name: 'Reflection Setup',
      screenId: 'ONBOARD-BEGINNER-07',
      nextId: 'into-app',
      backId: 'morning-checkin-setup',
      context: {
        screenId: 'ONBOARD-BEGINNER-07',
        screenName: 'Reflection Setup',
        contextBlock:
          'Set up a short evening reflection: when, which days, whether they want a reminder, and the style (guided prompts, custom prompts, or freeform). Frame it as a moment for their mind, not a chore.',
      },
      componentType: 'reflection-card',
      componentProps: { showDayPicker: true, showReminderToggle: true, showModePicker: true },
      voice: {
        openerText: 'Now your evening reflection. When works for you?',
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: {
        toolName: 'submit_reflection_config',
        persistsFields: ['reflectionConfig'],
        advancesStep: true,
      },
      persist: { step: 8 },
    },
    {
      // Terminal completion beat. Replaces the old hardcoded "You're all set"
      // line in FlowRenderer: it is a real node now, so the engine ends on it and
      // confirm_plan fires onboarding completion.
      id: 'into-app',
      type: 'beat',
      beatNumber: 11,
      name: 'Into the App',
      screenId: 'ONBOARD-COMPLETE',
      nextId: null,
      backId: null,
      context: {
        screenId: 'ONBOARD-COMPLETE',
        screenName: 'Into the App',
        contextBlock:
          'Onboarding is done. Warmly tell the user they are all set and take them in. Do not collect anything else.',
      },
      componentType: 'into-app',
      componentProps: {},
      voice: {
        openerText: "You're all set. Let's get started.",
        expectsInput: false,
        directLlmAllowed: true,
      },
      tool: { toolName: 'confirm_plan', persistsFields: [], advancesStep: true },
      persist: null,
    },
  ],
};
