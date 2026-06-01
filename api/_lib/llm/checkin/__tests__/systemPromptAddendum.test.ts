import { describe, expect, it } from 'vitest';
import { CHECKIN_TOOL_ADDENDUM } from '../systemPromptAddendum.js';

describe('CHECKIN_TOOL_ADDENDUM', () => {
  it('names every domain tool so the model knows its scope', () => {
    for (const name of [
      'create_habit',
      'complete_habit',
      'record_checkin',
      'start_focus',
      'log_metric',
      'query_habits',
      'get_summary',
      'suggest_habit',
    ]) {
      expect(CHECKIN_TOOL_ADDENDUM).toContain(name);
    }
  });

  it('states that navigate_next/update_profile are NOT available here', () => {
    expect(CHECKIN_TOOL_ADDENDUM).toMatch(/navigate_next/);
    expect(CHECKIN_TOOL_ADDENDUM).toMatch(/do not have|NOT have|do NOT/i);
  });

  it('instructs eager tool calls + brevity', () => {
    expect(CHECKIN_TOOL_ADDENDUM).toMatch(/eager/i);
    expect(CHECKIN_TOOL_ADDENDUM).toMatch(/not_found/);
  });
});
