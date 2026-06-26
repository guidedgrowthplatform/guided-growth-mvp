/**
 * Check-in flow documents (morning + evening), in the engine FlowDocument shape.
 *
 * These mirror the flow builder's MORNING_CHECKIN_FLOW and EVENING_CHECKIN_FLOW
 * (ggmvp-flow-builder/src/components/flow-designer/FlowBuilder.tsx). Unlike the
 * onboarding flow, the check-in flows are NOT yet driven through the designer ->
 * transform pipeline; they are authored here directly as the engine source of
 * truth and validated by validateFlow at load.
 *
 * Each beat carries its componentType (the renderer adapter), an opener (the
 * coach line), and, where the beat captures data, the matching check-in tool from
 * api/_lib/llm/checkin (record_checkin, complete_habit, log_reflection). The
 * `persist` field is left null on every beat: the check-in flows write through the
 * check-in handlers / hooks, not the onboarding_states saveStep path, so they do
 * not reuse the onboarding persistence step counter. Wiring the engine
 * orchestrator's persistence to the check-in save path is a documented follow-up.
 *
 * Coach-bubble beats are say-only (no tool); the state-check, habit-review, and
 * reflection beats render their interactive cards via the new adapters.
 *
 * NO EM DASHES.
 */
import type { FlowDocument } from '../types';

// Morning check-in: greeting -> state check (the four-row sleep/mood/energy/stress
// card) -> are-you-done nudge -> wrap. Mirrors MORNING_CHECKIN_FLOW.
export const morningCheckinV1: FlowDocument = {
  flowId: 'morning-checkin-v1',
  name: 'Morning Check-in',
  version: 1,
  publishedAt: '2026-06-26T00:00:00Z',
  entryNodeId: 'morning-greeting',
  nodes: [
    {
      id: 'morning-greeting',
      type: 'beat',
      beatNumber: 0,
      name: 'Morning Greeting',
      screenId: 'MCHECK-01',
      nextId: 'morning-state',
      backId: null,
      context: {
        screenId: 'MCHECK-01',
        screenName: 'Morning Greeting',
        contextBlock: 'Warm morning greeting. Invite the user into a quick check-in.',
      },
      componentType: 'coach-bubble',
      componentProps: {},
      voice: {
        openerText: 'Good morning. Ready to check in?',
        expectsInput: false,
        directLlmAllowed: true,
      },
      tool: null,
      persist: null,
    },
    {
      id: 'morning-state',
      type: 'beat',
      beatNumber: 1,
      name: 'Morning State Check',
      screenId: 'MCHECK-STATE',
      nextId: 'morning-are-you-done',
      backId: 'morning-greeting',
      context: {
        screenId: 'MCHECK-STATE',
        screenName: 'Morning State Check',
        contextBlock:
          'Capture how the user is landing this morning across sleep, mood, energy, and stress. They tap each row or just tell you. Record what they give, do not push for the rest.',
      },
      componentType: 'state-check',
      componentProps: { dimensions: ['sleep', 'mood', 'energy', 'stress'] },
      voice: {
        openerText:
          'How are you feeling this morning? Mood, energy, sleep, any stress on your mind. Tap what fits or just tell me.',
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: { toolName: 'record_checkin', persistsFields: ['checkin'], advancesStep: true },
      persist: null,
    },
    {
      id: 'morning-are-you-done',
      type: 'beat',
      beatNumber: 2,
      name: 'Anything Else',
      screenId: 'MCHECK-DONE',
      nextId: 'morning-wrap',
      backId: 'morning-state',
      context: {
        screenId: 'MCHECK-DONE',
        screenName: 'Anything Else',
        contextBlock:
          'Check whether the user wants to add anything before wrapping. If they are done, move on without pressure.',
      },
      componentType: 'coach-bubble',
      componentProps: {},
      voice: {
        openerText:
          'Looks like there are a few items left. Want to add anything, or should we move on?',
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: null,
      persist: null,
    },
    {
      id: 'morning-wrap',
      type: 'beat',
      beatNumber: 3,
      name: 'Morning Wrap',
      screenId: 'MCHECK-WRAP',
      nextId: null,
      backId: 'morning-are-you-done',
      context: {
        screenId: 'MCHECK-WRAP',
        screenName: 'Morning Wrap',
        contextBlock: 'Close the morning check-in warmly. Send them into the day.',
      },
      componentType: 'coach-bubble',
      componentProps: {},
      voice: {
        openerText: "That's a good start. Go make it a good one.",
        expectsInput: false,
        directLlmAllowed: true,
      },
      tool: null,
      persist: null,
    },
  ],
};

// Evening check-in: greeting + habits -> habit review (done / not done / pending)
// -> are-you-done nudge -> reflection (proud / forgive / grateful) -> wrap.
// Mirrors EVENING_CHECKIN_FLOW.
export const eveningCheckinV1: FlowDocument = {
  flowId: 'evening-checkin-v1',
  name: 'Evening Check-in',
  version: 1,
  publishedAt: '2026-06-26T00:00:00Z',
  entryNodeId: 'evening-greeting',
  nodes: [
    {
      id: 'evening-greeting',
      type: 'beat',
      beatNumber: 0,
      name: 'Evening Greeting',
      screenId: 'ECHECK-01',
      nextId: 'evening-habit-review',
      backId: null,
      context: {
        screenId: 'ECHECK-01',
        screenName: 'Evening Greeting',
        contextBlock:
          "Warm evening greeting. Surface today's habits and ask how the day went.",
      },
      componentType: 'coach-bubble',
      componentProps: {},
      voice: {
        openerText: 'Hey, good evening. Here are your habits for today. How did the day go?',
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: null,
      persist: null,
    },
    {
      id: 'evening-habit-review',
      type: 'beat',
      beatNumber: 1,
      name: 'Habit Review',
      screenId: 'ECHECK-HABITS',
      nextId: 'evening-are-you-done',
      backId: 'evening-greeting',
      context: {
        screenId: 'ECHECK-HABITS',
        screenName: 'Habit Review',
        contextBlock:
          "Walk today's habits. For each, mark it done, not done, or leave it pending as the user reports. Do not judge a missed habit.",
      },
      componentType: 'habit-review',
      componentProps: {},
      voice: {
        openerText: 'Tap each habit to mark it, or just tell me how each one went.',
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: { toolName: 'complete_habit', persistsFields: ['habitStatuses'], advancesStep: true },
      persist: null,
    },
    {
      id: 'evening-are-you-done',
      type: 'beat',
      beatNumber: 2,
      name: 'Anything Else',
      screenId: 'ECHECK-DONE',
      nextId: 'evening-reflection',
      backId: 'evening-habit-review',
      context: {
        screenId: 'ECHECK-DONE',
        screenName: 'Anything Else',
        contextBlock:
          'Check whether the user wants to add anything before reflecting. If they are done, move on.',
      },
      componentType: 'coach-bubble',
      componentProps: {},
      voice: {
        openerText:
          'Looks like there are a few items left. Want to add anything, or should we move on?',
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: null,
      persist: null,
    },
    {
      id: 'evening-reflection',
      type: 'beat',
      beatNumber: 3,
      name: 'Evening Reflection',
      screenId: 'ECHECK-REFLECT',
      nextId: 'evening-wrap',
      backId: 'evening-are-you-done',
      context: {
        screenId: 'ECHECK-REFLECT',
        screenName: 'Evening Reflection',
        contextBlock:
          'A short reflection: what they are proud of, what they forgive themselves for, what they are grateful for. Let the user answer in their own words. Save what they share.',
      },
      componentType: 'reflection',
      componentProps: {
        questions: [
          { key: 'proud', prompt: 'What are you proud of today?' },
          { key: 'forgive', prompt: 'What do you forgive yourself for today?' },
          { key: 'grateful', prompt: 'What are you grateful for today?' },
        ],
        transition: "Good. Now let's take a moment to reflect on the day itself.",
      },
      voice: {
        openerText: "Good. Now let's take a moment to reflect on the day itself.",
        expectsInput: true,
        directLlmAllowed: true,
      },
      tool: { toolName: 'log_reflection', persistsFields: ['reflectionText'], advancesStep: true },
      persist: null,
    },
    {
      id: 'evening-wrap',
      type: 'beat',
      beatNumber: 4,
      name: 'Evening Wrap',
      screenId: 'ECHECK-WRAP',
      nextId: null,
      backId: 'evening-reflection',
      context: {
        screenId: 'ECHECK-WRAP',
        screenName: 'Evening Wrap',
        contextBlock: 'Close the evening check-in warmly. Wish them a good night.',
      },
      componentType: 'coach-bubble',
      componentProps: {},
      voice: {
        openerText: "That's it for tonight. Sleep well.",
        expectsInput: false,
        directLlmAllowed: true,
      },
      tool: null,
      persist: null,
    },
  ],
};

export const CHECKIN_FLOWS = {
  'morning-checkin-v1': morningCheckinV1,
  'evening-checkin-v1': eveningCheckinV1,
} as const;
