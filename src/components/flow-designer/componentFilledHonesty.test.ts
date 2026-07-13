import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { BEAT_BY_ID } from './beatsSource';

// F3-R: a 'filled' components claim must not be possible when the mapped component
// does not render the declared affordance. This locks the honest baseline in
// vitest too (the marker-independent guard also lives in
// scripts/checks/component-registry-check.mjs).

const dir = path.dirname(fileURLToPath(import.meta.url));
const goalsListSource = readFileSync(path.join(dir, 'beats/goalsList.tsx'), 'utf8');

const CONTINUE_AFFORDANCE_RE = /advance_step|onContinue|handleContinue|>\s*Continue\b/;
const COUNTER_AFFORDANCE_RE =
  /of\s*\{?\s*MAX_SUBCATEGORIES|of\s*\{?\s*max\b|selectedCount|of \d+ selected/i;

describe('F3-R: goals-list owned component contract', () => {
  const goalsSleep = BEAT_BY_ID['goals-sleep'];
  const components = goalsSleep.bible!.components!;
  const componentsStr = JSON.stringify(components);

  it('the goals-list component renders the declared Continue / counter affordance', () => {
    expect(CONTINUE_AFFORDANCE_RE.test(goalsListSource)).toBe(true);
    expect(COUNTER_AFFORDANCE_RE.test(goalsListSource)).toBe(true);
  });

  it('owns its declared component contract', () => {
    // Declared affordances present in the section text.
    expect(/Continue affordance/i.test(componentsStr)).toBe(true);
    expect(/n of \d+ selected/i.test(componentsStr)).toBe(true);
    expect(goalsSleep.bible!.sectionManifest.components).toBe('filled');
  });
});
