import { describe, expect, it } from 'vitest';
import type { SessionStateDeltaEntry } from '@shared/types/context.js';
import { buildAssistantOverrides } from './buildAssistantOverrides';

function makeEvent(over: Partial<SessionStateDeltaEntry> = {}): SessionStateDeltaEntry {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    session_id: 'session-1',
    timestamp: '2026-05-22T10:00:00.000Z',
    event_type: 'navigate',
    screen_id: 'ONBOARD-01',
    payload: null,
    ...over,
  };
}

describe('buildAssistantOverrides', () => {
  it('sets firstMessageMode so Vapi generates the opening from the system prompt', () => {
    const out = buildAssistantOverrides({
      screenId: 'ONBOARD-BEGINNER-02',
      contextBlock: 'Pick your focus area.',
      stateDelta: [],
    });
    expect(out.firstMessageMode).toBe('assistant-speaks-first-with-model-generated-message');
  });

  it('embeds the screen id and context block in the initial_screen_context variable', () => {
    const out = buildAssistantOverrides({
      screenId: 'ONBOARD-BEGINNER-02',
      contextBlock: 'Pick your focus area.',
      stateDelta: [],
    });
    const content = out.variableValues.initial_screen_context;
    expect(content).toContain('ONBOARD-BEGINNER-02');
    expect(content).toContain('Pick your focus area.');
  });

  it('renders recent session_log events so the model knows what the user was doing', () => {
    const out = buildAssistantOverrides({
      screenId: 'ONBOARD-BEGINNER-03',
      contextBlock: 'ctx',
      stateDelta: [
        makeEvent({
          event_type: 'habit_added',
          payload: { habit_name: 'morning walk' },
        }),
        makeEvent({
          id: '00000000-0000-0000-0000-000000000002',
          event_type: 'navigate',
          payload: { to: 'ONBOARD-BEGINNER-03' },
        }),
      ],
    });
    const content = out.variableValues.initial_screen_context;
    expect(content).toContain('habit_added');
    expect(content).toContain('morning walk');
    expect(content).toContain('navigate');
  });

  it('renders the "(none)" marker when state_delta is empty (new user, no history)', () => {
    const out = buildAssistantOverrides({
      screenId: 'ONBOARD-01',
      contextBlock: 'ctx',
      stateDelta: [],
    });
    expect(out.variableValues.initial_screen_context).toContain('(none)');
  });
});
