/**
 * Onboarding flow v1 — authored to the flow-builder export spec
 * (gg-spec/docs/flow-builder-export-spec.md). This is the static, committed
 * source of truth for the engine today; see ../useFlow.ts for the Supabase
 * swap seam.
 *
 * The 'simple' (beginner) lane is fully built and reuses the real Step save
 * path (saveStep 1/3/4/5/6 + complete). The 'braindump' (advanced) lane is
 * represented by one brain-dump beat that rejoins at plan-review; the rich
 * 4-screen advanced lane is a documented follow-up (spec section 6.5).
 */
import type { FlowDocument } from '../types';

export const onboardingBeginnerV1: FlowDocument = {
  flowId: 'onboarding-beginner-v1',
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
      nextId: 'profile',
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
      id: 'profile',
      type: 'beat',
      beatNumber: 1,
      name: 'Profile',
      screenId: 'ONBOARD-01--FORM',
      nextId: 'path-fork',
      backId: null,
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
      voice: {
        openerText:
          'Alright, a couple quick things so I can tailor this to you. How old are you, and how do you identify? You can say it or tap it in.',
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: {
        toolName: 'submit_profile',
        persistsFields: ['age', 'gender'],
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
          exitNodeId: 'reflection-setup',
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
        openerText:
          'How do you like to work? I can guide you step by step, or you can just tell me everything on your mind.',
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
        openerText: 'What feels most worth improving right now?',
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
      voice: { openerText: null, expectsInput: true, directLlmAllowed: true },
      tool: { toolName: 'submit_goals', persistsFields: ['goals'], advancesStep: true },
      persist: { step: 4 },
    },
    {
      id: 'habit-select',
      type: 'beat',
      beatNumber: 6,
      name: 'Habit Selection',
      screenId: 'ONBOARD-BEGINNER-03',
      nextId: 'reflection-setup',
      backId: 'goals',
      context: {
        screenId: 'ONBOARD-BEGINNER-03',
        screenName: 'Habit Selection',
        contextBlock:
          'Help them pick up to two small daily habits to start with. Small and doable beats ambitious. They can always add more later.',
      },
      componentType: 'habit-picker',
      componentProps: { maxPerGoal: 2, optionSource: 'habitsByGoal' },
      voice: { openerText: null, expectsInput: true, directLlmAllowed: true },
      tool: { toolName: 'add_habit', persistsFields: ['habits'], advancesStep: false },
      persist: { step: 5 },
    },
    {
      id: 'reflection-setup',
      type: 'beat',
      beatNumber: 7,
      name: 'Reflection Setup',
      screenId: 'ONBOARD-BEGINNER-07',
      nextId: 'plan-review',
      backId: 'habit-select',
      context: {
        screenId: 'ONBOARD-BEGINNER-07',
        screenName: 'Reflection Setup',
        contextBlock:
          'Set up a short daily reflection: when, which days, and whether they want a reminder. Frame it as a moment for their mind, not a chore.',
      },
      componentType: 'reflection-card',
      componentProps: { showDayPicker: true, showReminderToggle: true },
      voice: { openerText: null, expectsInput: true, directLlmAllowed: true },
      tool: {
        toolName: 'submit_reflection_config',
        persistsFields: ['reflectionConfig'],
        advancesStep: true,
      },
      persist: { step: 6 },
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
      componentType: 'coach-bubble',
      componentProps: {
        brainDump: true,
        placeholder: 'Tell me everything on your mind — what you want to build, drop, or change.',
      },
      voice: {
        openerText: 'Go ahead, tell me everything on your mind. I will organize it.',
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
      nextId: null,
      backId: 'reflection-setup',
      context: {
        screenId: 'ONBOARD-BEGINNER-06',
        screenName: 'Plan Review',
        contextBlock:
          'Show them the plan you built together and ask if they want to change anything before starting. If they are happy, take them in.',
      },
      componentType: 'plan-cards',
      componentProps: { showJournalCard: true },
      voice: {
        openerText: "Here's your plan. Want to change anything before we start?",
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: { toolName: 'confirm_plan', persistsFields: [], advancesStep: true },
      persist: null,
    },
  ],
};
