import { describe, it, expect } from 'vitest';
import { NO_PRENARRATION_RULE } from '../noPrenarrationRule.js';

describe('NO_PRENARRATION_RULE', () => {
  it('forbids narrating the next screen', () => {
    expect(NO_PRENARRATION_RULE).toMatch(/never .*(begin|preview|narrate)/i);
    expect(NO_PRENARRATION_RULE).toMatch(/next screen/i);
  });

  it('still permits tool-driven advancement', () => {
    expect(NO_PRENARRATION_RULE).toMatch(/your tools|save data|confirm the step/i);
  });

  it('names no tools (safe on tool-less screens)', () => {
    expect(NO_PRENARRATION_RULE).not.toMatch(/navigate_next|update_profile|advance_step/);
  });
});
