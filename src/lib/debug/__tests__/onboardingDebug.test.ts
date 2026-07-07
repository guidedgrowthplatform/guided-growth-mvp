import { describe, expect, it } from 'vitest';
import { toolResultErrorCode } from '../onboardingDebug';

describe('toolResultErrorCode', () => {
  it('surfaces the real server error code (e.g. unknown_tool) instead of a generic label', () => {
    expect(toolResultErrorCode({ error: 'unknown_tool', message: 'Unknown tool: foo' })).toBe(
      'unknown_tool',
    );
  });

  it('surfaces onboarding-specific codes the same way', () => {
    expect(toolResultErrorCode({ error: 'habit_name_ungrounded' })).toBe('habit_name_ungrounded');
    expect(toolResultErrorCode({ error: 'checkin_not_grounded' })).toBe('checkin_not_grounded');
  });

  it('falls back to tool_failed when the payload carries no error field', () => {
    expect(toolResultErrorCode({})).toBe('tool_failed');
  });

  it('falls back to tool_failed when the payload is not an object', () => {
    expect(toolResultErrorCode(null)).toBe('tool_failed');
    expect(toolResultErrorCode(undefined)).toBe('tool_failed');
    expect(toolResultErrorCode('boom')).toBe('tool_failed');
  });

  it('falls back to tool_failed when error is present but not a usable string', () => {
    expect(toolResultErrorCode({ error: '' })).toBe('tool_failed');
    expect(toolResultErrorCode({ error: 42 })).toBe('tool_failed');
    expect(toolResultErrorCode({ error: null })).toBe('tool_failed');
  });
});
