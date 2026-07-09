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

import { ownBibleBeats, loadBeats, report } from './lib/beats-ast.mjs';

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

report(
  problems,
  `component-registry-check passed: ${bibleBeats.length} bible-bearing beat(s) checked, ` +
    `no-preselection and variant/props fidelity both hold.`,
);
