import { describe, expect, it } from 'vitest';
import { parseWeeklyToolCalls } from './parseWeeklyToolCalls';

describe('parseWeeklyToolCalls', () => {
  it('reads the singular function-call shape', () => {
    const msg = { type: 'function-call', functionCall: { name: 'weekly_advance', parameters: {} } };
    expect(parseWeeklyToolCalls(msg)).toEqual(['weekly_advance']);
  });

  it('reads the batched tool-calls shape with nested function.name', () => {
    const msg = {
      type: 'tool-calls',
      toolCallList: [
        { id: 't1', type: 'function', function: { name: 'weekly_complete', arguments: '{}' } },
      ],
    };
    expect(parseWeeklyToolCalls(msg)).toEqual(['weekly_complete']);
  });

  it('reads the batched tool-calls shape with a flat name on the list item', () => {
    const msg = { type: 'tool-calls', toolCallList: [{ name: 'weekly_add_habit' }] };
    expect(parseWeeklyToolCalls(msg)).toEqual(['weekly_add_habit']);
  });

  it('returns every weekly tool in a multi-call batch, in order', () => {
    const msg = {
      type: 'tool-calls',
      toolCallList: [
        { function: { name: 'weekly_update_habit' } },
        { function: { name: 'weekly_advance' } },
      ],
    };
    expect(parseWeeklyToolCalls(msg)).toEqual(['weekly_update_habit', 'weekly_advance']);
  });

  it('ignores non-weekly tool names', () => {
    expect(
      parseWeeklyToolCalls({ type: 'function-call', functionCall: { name: 'submit_profile' } }),
    ).toEqual([]);
    expect(
      parseWeeklyToolCalls({
        type: 'tool-calls',
        toolCallList: [{ function: { name: 'navigate_next' } }],
      }),
    ).toEqual([]);
  });

  it('returns [] for transcript / status / non-tool messages', () => {
    expect(parseWeeklyToolCalls({ type: 'transcript', transcript: 'hi', role: 'user' })).toEqual(
      [],
    );
    expect(parseWeeklyToolCalls({ type: 'status-update', status: 'in-progress' })).toEqual([]);
  });

  it('returns [] for malformed / empty input', () => {
    expect(parseWeeklyToolCalls(null)).toEqual([]);
    expect(parseWeeklyToolCalls(undefined)).toEqual([]);
    expect(parseWeeklyToolCalls('weekly_advance')).toEqual([]);
    expect(parseWeeklyToolCalls({})).toEqual([]);
    expect(parseWeeklyToolCalls({ type: 'tool-calls', toolCallList: 'nope' })).toEqual([]);
    expect(parseWeeklyToolCalls({ type: 'function-call', functionCall: null })).toEqual([]);
  });
});
