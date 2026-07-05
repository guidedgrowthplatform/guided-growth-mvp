import { describe, expect, it } from 'vitest';
import { READ_OPTIONS_ON_REQUEST_RULE } from '../readOptionsOnRequestRule.js';

describe('READ_OPTIONS_ON_REQUEST_RULE', () => {
  it('keeps the anti-narration default (no unprompted option lists)', () => {
    // Default half of the rule: options are not volunteered unprompted.
    expect(READ_OPTIONS_ON_REQUEST_RULE).toMatch(/do NOT read that list out loud/i);
    expect(READ_OPTIONS_ON_REQUEST_RULE).toMatch(/unprompted/i);
  });

  it('flips the direct-ask case from refuse to recite', () => {
    // Exception half: a direct request means the coach reads the options.
    expect(READ_OPTIONS_ON_REQUEST_RULE).toMatch(/EXCEPTION/);
    expect(READ_OPTIONS_ON_REQUEST_RULE).toMatch(/what are my options\?/i);
    expect(READ_OPTIONS_ON_REQUEST_RULE).toMatch(/read them to me/i);
    expect(READ_OPTIONS_ON_REQUEST_RULE).toMatch(/DO read them/);
  });

  it('scopes the exception: only on a real request, only the current screen', () => {
    // "I'm not sure" alone is not a request; the next screen's options stay off-limits.
    expect(READ_OPTIONS_ON_REQUEST_RULE).toMatch(/Only when they actually ASK/i);
    expect(READ_OPTIONS_ON_REQUEST_RULE).toMatch(/CURRENT screen/);
    expect(READ_OPTIONS_ON_REQUEST_RULE).toMatch(/Never read the next screen/i);
  });
});
