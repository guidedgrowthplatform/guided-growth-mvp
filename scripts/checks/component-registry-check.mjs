// Registry id: component-registry-check
// Meaning (ENFORCER_REGISTRY, flowBible.ts): "declared component/variant/state
// matches registry; includes no-preselection".
//
// Grounded in bible.components on category-women / goals-sleep:
//   1. No-preselection: any selection-type beat (its `type` contains "grid" or
//      "list", i.e. a tap-to-choose component) must have a components row whose
//      text affirmatively states nothing is preselected on entry (the render's
//      own documented convention: "nothing selected on entry"). A row that says
//      something is "preselected" without an explicit "nothing"/"not"/"no"
//      qualifier directly contradicts the no-preselection global rule
//      (glob-no-preselection in flowBible.ts) and is a real defect.
//   2. Variant/props fidelity: when a beat declares `props` (e.g.
//      { variant: 'female' } or { category: 'Sleep better' }), those exact
//      values must show up somewhere in the components section text. This is
//      precisely the class of bug the whole-system QA flagged for inherited
//      variants (a components block asserting the WRONG category/variant's
//      tiles) — this check guards any OWN-authored components block against
//      silently drifting from the beat's own props.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ownBibleBeats, loadBeats, report, ROOT } from './lib/beats-ast.mjs';

const problems = [];

const { beats } = await loadBeats();
const bibleBeats = ownBibleBeats(beats);

const SELECTION_TYPE_RE = /grid|list/i;
const PRESELECTED_RE = /\bpreselected\b/i;
const NO_PRESELECTION_RE =
  /nothing selected|nothing preselected|no preselection|not preselected|none selected/i;

for (const { beatId, value: beat, line } of bibleBeats) {
  const components = beat.bible.components;
  if (!components || !Array.isArray(components.rows) || components.rows.length === 0) continue;

  const rowTexts = components.rows.map((r) => `${r.label}: ${r.value}`);
  const combined = rowTexts.join(' | ');

  // 1. No-preselection, required for tap-to-choose component types.
  if (SELECTION_TYPE_RE.test(beat.type ?? '')) {
    if (!NO_PRESELECTION_RE.test(combined)) {
      problems.push(
        `${beatId} (line ${line}): type "${beat.type}" is a selection component but no components ` +
          `row states nothing is preselected on entry (glob-no-preselection)`,
      );
    }
    // A row asserting "preselected" without the negation phrasing is a straight
    // contradiction of the no-preselection rule.
    for (const text of rowTexts) {
      if (PRESELECTED_RE.test(text) && !NO_PRESELECTION_RE.test(text)) {
        problems.push(
          `${beatId} (line ${line}): components row "${text}" asserts a preselection, ` +
            `which violates the no-preselection rule`,
        );
      }
    }
  }

  // 2. Every declared prop value must be traceable in the components section.
  const props = beat.props && typeof beat.props === 'object' ? beat.props : null;
  if (props) {
    for (const [propKey, propValue] of Object.entries(props)) {
      if (typeof propValue !== 'string' || propValue.length === 0) continue;
      if (!combined.includes(propValue)) {
        problems.push(
          `${beatId} (line ${line}): props.${propKey} = "${propValue}" is not referenced anywhere ` +
            `in bible.components — the declared component/variant no longer matches the beat's own props`,
        );
      }
    }
  }
}

// 3. Declared component STATE vs the REAL component source (statically cheap).
// Map a selection beat type -> its render component.
//
// F3-R: the prior version gated purely on the "ASSERTED SPEC ... does not
// implement yet" marker text, so deleting the marker AND flipping the components
// manifest to 'filled' bypassed both this check and bible-registry-check :428.
// This version is a render assertion of the DECLARED state keyed off the components
// MANIFEST STATUS + the DECLARED affordances + the actual component source, NOT the
// deletable marker: a 'filled' components claim CANNOT pass when the mapped
// component does not render the affordance the section declares.
const TYPE_TO_COMPONENT = {
  'goals-list': 'src/components/flow-designer/beats/goalsList.tsx',
  'habit-picker': 'src/components/flow-designer/beats/habitPicker.tsx',
  'weekly-projection': 'src/components/flow-designer/beats/weeklyProjection.tsx',
};
const ASSERTED_UNIMPLEMENTED_RE = /ASSERTED SPEC[\s\S]*?does not implement yet/i;
const CONTINUE_AFFORDANCE_RE = /advance_step|onContinue|handleContinue|>\s*(?:Continue|Next)\b/;
const COUNTER_AFFORDANCE_RE =
  /of\s*\{?\s*MAX_SUBCATEGORIES|of\s*\{?\s*max\b|selectedCount|of \d+ selected/i;
const DECLARES_CONTINUE_RE = /(?:Continue|Next) affordance/i;
const DECLARES_COUNTER_RE = /n of \d+ selected/i;

let stateChecked = 0;
for (const { beatId, value: beat, line } of bibleBeats) {
  const componentPath = TYPE_TO_COMPONENT[beat.type ?? ''];
  const components = beat.bible?.components;
  if (!componentPath || !components) continue;

  const componentsStr = JSON.stringify(components);
  const manifestStatus = beat.bible?.sectionManifest?.components;
  const declaresContinue = DECLARES_CONTINUE_RE.test(componentsStr);
  const declaresCounter = DECLARES_COUNTER_RE.test(componentsStr);
  const hasMarker = ASSERTED_UNIMPLEMENTED_RE.test(componentsStr);

  // Only mapped selection components that DECLARE the not-yet-built affordances (or
  // still carry the marker) need the render assertion.
  if (!declaresContinue && !declaresCounter && !hasMarker) continue;

  let source;
  try {
    source = await readFile(path.join(ROOT, componentPath), 'utf8');
  } catch {
    problems.push(`${beatId}: maps type "${beat.type}" to ${componentPath}, which does not exist`);
    continue;
  }
  stateChecked += 1;
  const implementsContinue = CONTINUE_AFFORDANCE_RE.test(source);
  const implementsCounter = COUNTER_AFFORDANCE_RE.test(source);

  // (a) Bypass closure, marker-INDEPENDENT: a 'filled' components claim requires the
  // component to actually render every affordance the section declares.
  if (manifestStatus === 'filled') {
    if (declaresContinue && !implementsContinue) {
      problems.push(
        `${beatId} (line ${line}): bible.components manifest claims 'filled' but ${componentPath} ` +
          `does not render the declared "Continue affordance" (no advance/Continue control) — ` +
          `a filled components claim cannot pass when the component does not render it`,
      );
    }
    if (declaresCounter && !implementsCounter) {
      problems.push(
        `${beatId} (line ${line}): bible.components manifest claims 'filled' but ${componentPath} ` +
          `does not render the declared "n of N selected" counter — ` +
          `a filled components claim cannot pass when the component does not render it`,
      );
    }
  }

  // (b) Stale-marker: if the beat still carries the ASSERTED-unimplemented marker but
  // the component now DOES implement the affordance, the marker/manifest is stale.
  if (hasMarker && (implementsContinue || implementsCounter)) {
    problems.push(
      `${beatId} (line ${line}): bible.components marks the counter/Continue affordance ` +
        `ASSERTED-unimplemented, but ${componentPath} appears to implement it — the marker is ` +
        `stale, update the manifest/marker to match the component`,
    );
  }
}

report(
  problems,
  `component-registry-check passed: ${bibleBeats.length} bible-bearing beat(s) checked, ` +
    `no-preselection and variant/props fidelity hold; ` +
    `${stateChecked} declared-affordance component(s) verified against real component source ` +
    `(a 'filled' claim cannot pass an unbuilt affordance).`,
);
