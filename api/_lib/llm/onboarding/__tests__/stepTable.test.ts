import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ONBOARDING_STEPS,
  SCREEN_STEP,
  stepRequirement,
  renderStepProgressionLine,
} from '../stepTable.js';

describe('onboarding step table', () => {
  it('is contiguous from FIRST_STEP with unique step numbers', () => {
    const steps = ONBOARDING_STEPS.map((s) => s.step);
    expect(steps).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(steps).size).toBe(steps.length);
  });

  it('maps requirements by step', () => {
    expect(stepRequirement(1)).toBe('nickname');
    expect(stepRequirement(6)).toBe('reflection');
    expect(stepRequirement(7)).toBeNull();
    expect(stepRequirement(99)).toBeNull();
  });

  it('renders a progression line for the linear core', () => {
    expect(renderStepProgressionLine()).toContain('profile(1)→2');
    expect(renderStepProgressionLine()).toContain('reflection(6)→7');
  });

  // Tripwire: catches a silent desync if the generated bundle is renumbered.
  it('SCREEN_STEP stays in sync with the bundle target_step literals', () => {
    const bundlePath = fileURLToPath(
      new URL('../../../../../src/generated/screen_contexts.json', import.meta.url),
    );
    const bundle = JSON.parse(readFileSync(bundlePath, 'utf8')) as {
      screens: Record<string, { context_block: string }>;
    };

    for (const [screenId, expectedStep] of Object.entries(SCREEN_STEP)) {
      const block = bundle.screens[screenId]?.context_block;
      if (!block) continue; // screen not in the Phase-1 bundle yet
      const matches = [...block.matchAll(/navigate_next\(target_step=(\d+)\)/g)].map((m) =>
        Number(m[1]),
      );
      if (matches.length === 0) continue; // finalize screens use confirm_plan
      expect(matches, `${screenId} forward target_step`).toContain(expectedStep + 1);
    }
  });
});
