import { describe, expect, it } from 'vitest';
import {
  buildBeatMachinery,
  buildOpenerDirective,
  composeOnboardingContextBlock,
  getBeatOpener,
  isBundledBeat,
} from './onboardingBeatBundle';

describe('onboarding beat machinery (flow-derived)', () => {
  it('emits the data tool + navigate_next with the flow target_step', () => {
    const m = buildBeatMachinery('ONBOARD-BEGINNER-01');
    expect(m).toContain('- submit_category');
    expect(m).toContain('navigate_next(target_step=4)');
    expect(m).toContain('FORBIDDEN ON THIS SCREEN:');
    expect(m).toContain('add_habit'); // forbidden here
  });

  it('targets plan-review (step 6) from the habit beats — habits are one step', () => {
    expect(buildBeatMachinery('ONBOARD-BEGINNER-03')).toContain('navigate_next(target_step=6)');
    expect(buildBeatMachinery('ONBOARD-BEGINNER-04')).toContain('navigate_next(target_step=6)');
  });

  it('plan-review advances to morning-setup per the flow builder (target 7)', () => {
    expect(buildBeatMachinery('ONBOARD-BEGINNER-06')).toContain('navigate_next(target_step=7)');
  });

  it('the terminal beat allows only confirm_plan and forbids navigate_next', () => {
    const m = buildBeatMachinery('ONBOARD-COMPLETE');
    expect(m).toContain('- confirm_plan');
    expect(m).not.toContain('navigate_next(target_step');
    expect(m).toMatch(/FORBIDDEN[^]*navigate_next/);
  });

  it('composes machinery above the synced coach copy', () => {
    const block = composeOnboardingContextBlock('ONBOARD-BEGINNER-01');
    expect(block).not.toBeNull();
    const machineryIdx = block!.indexOf('ALLOWED TOOLS');
    const copyIdx = block!.indexOf('BEAT: Focus area.');
    expect(machineryIdx).toBeGreaterThanOrEqual(0);
    expect(copyIdx).toBeGreaterThan(machineryIdx);
  });

  it('returns null for non-onboarding screens (caller falls back to screen_contexts)', () => {
    expect(isBundledBeat('HOME-01')).toBe(false);
    expect(composeOnboardingContextBlock('HOME-01')).toBeNull();
  });

  it('builds a verbatim opener directive carrying the authored opener line', () => {
    const opener = getBeatOpener('ONBOARD-BEGINNER-01');
    expect(opener).toBeTruthy();
    const directive = buildOpenerDirective('ONBOARD-BEGINNER-01');
    expect(directive).toContain('verbatim');
    expect(directive).toContain(opener!);
  });

  it('has no opener directive for a silent / opener-less beat', () => {
    // AUTH is silent (no opener) → no directive.
    expect(getBeatOpener('ONBOARD-AUTH--FORM')).toBeNull();
    expect(buildOpenerDirective('ONBOARD-AUTH--FORM')).toBeNull();
  });
});
