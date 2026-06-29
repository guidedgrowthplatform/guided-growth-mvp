/**
 * Home tour flow (v1) -- extracted from FlowBuilder.tsx HOME_TOUR_FLOW (lines 734-780).
 *
 * Each beat uses componentType 'home-tour'. This type is present in the flow builder
 * (FlowBuilder.tsx:432, beats/homeTour.tsx) but is NOT yet registered in the engine
 * component registry (src/onboarding-flow/renderer/componentRegistry.tsx has no
 * 'home-tour' entry). As a result the engine renderer will show the coach text but
 * have no interactive card to call onCapture -- the flow stalls at each beat until
 * the adapter is wired (tracked in HANDOFF-app-shell-and-flow-order.md).
 *
 * This file is the correct landing point for the QA /flow-preview/home-tour route.
 * When the adapter is added to componentRegistry.tsx, this document works without
 * changes (the componentType strings will match).
 *
 * NO EM DASHES.
 */
import type { FlowDocument } from '../types';

export const homeTourV1: FlowDocument = {
  flowId: 'home-tour-v1',
  name: 'Home Tour',
  version: 1,
  publishedAt: '2026-06-29T00:00:00Z',
  entryNodeId: 'home-tour-1',
  nodes: [
    {
      id: 'home-tour-1',
      type: 'beat',
      beatNumber: 0,
      name: 'Welcome home',
      screenId: 'HOME-TOUR-01',
      nextId: 'home-tour-2',
      backId: null,
      context: {
        screenId: 'HOME-TOUR-01',
        screenName: 'Welcome home',
        contextBlock: 'Onboarding is complete. Welcome the user to their home space.',
      },
      componentType: 'home-tour',
      componentProps: { stage: 'land' },
      voice: {
        openerText: "That's everything. Welcome home. This is your space.",
        expectsInput: false,
        directLlmAllowed: false,
      },
      tool: null,
      persist: null,
    },
    {
      id: 'home-tour-2',
      type: 'beat',
      beatNumber: 1,
      name: 'Connect',
      screenId: 'HOME-TOUR-02',
      nextId: 'home-tour-3',
      backId: 'home-tour-1',
      context: {
        screenId: 'HOME-TOUR-02',
        screenName: 'Connect',
        contextBlock: "Show that the chat is always available and their work from onboarding is here.",
      },
      componentType: 'home-tour',
      componentProps: { stage: 'connect' },
      voice: {
        openerText: "Everything we just did lives here. The chat's always a tap away.",
        expectsInput: false,
        directLlmAllowed: false,
      },
      tool: null,
      persist: null,
    },
    {
      id: 'home-tour-3',
      type: 'beat',
      beatNumber: 2,
      name: 'Reveal habits',
      screenId: 'HOME-TOUR-03',
      nextId: 'home-tour-4',
      backId: 'home-tour-2',
      context: {
        screenId: 'HOME-TOUR-03',
        screenName: 'Reveal habits',
        contextBlock: 'Point to the habit list and the reflection log.',
      },
      componentType: 'home-tour',
      componentProps: { stage: 'reveal' },
      voice: {
        openerText:
          'These are your habits. Tap one done when you finish it. Your reflections land here too.',
        expectsInput: false,
        directLlmAllowed: false,
      },
      tool: null,
      persist: null,
    },
    {
      id: 'home-tour-4',
      type: 'beat',
      beatNumber: 3,
      name: 'Chat access',
      screenId: 'HOME-TOUR-04',
      nextId: 'home-tour-5',
      backId: 'home-tour-3',
      context: {
        screenId: 'HOME-TOUR-04',
        screenName: 'Chat access',
        contextBlock: 'Point to the feedback tab and the persistent chat button.',
      },
      componentType: 'home-tour',
      componentProps: { stage: 'chat' },
      voice: {
        openerText:
          "Feedback's here for me. And the chat's right here, tap it whenever. Otherwise, this is home.",
        expectsInput: false,
        directLlmAllowed: false,
      },
      tool: null,
      persist: null,
    },
    {
      id: 'home-tour-5',
      type: 'beat',
      beatNumber: 4,
      name: 'Live',
      screenId: 'HOME-TOUR-LIVE',
      nextId: null,
      backId: 'home-tour-4',
      context: {
        screenId: 'HOME-TOUR-LIVE',
        screenName: 'Live',
        contextBlock: 'The tour ends and the user is in the live app.',
      },
      componentType: 'home-tour',
      componentProps: { stage: 'live' },
      voice: {
        openerText: "You're all set. Go make it a good one.",
        expectsInput: false,
        directLlmAllowed: false,
      },
      tool: null,
      persist: null,
    },
  ],
};
