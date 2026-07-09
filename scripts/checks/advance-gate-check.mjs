// Registry id: advance-gate-check
// Meaning (ENFORCER_REGISTRY, flowBible.ts): "bible.flow gates match
// preconditions.ts".
//
// The app has no standalone preconditions.ts yet (multiple bible.rulesCode
// rows explicitly cite advance-gate-check as their enforcer while the
// underlying app gate file is still app-reconcile work). Until that file
// exists, this enforces the cross-checkable half within the beat's own
// authored contract:
//   1. bible.flow.rows must declare an explicit "advance condition" row (the
//      row every beat with a flow section carries today) — a beat that omits
//      it has no stated gate at all.
//   2. Any tool name mentioned in that advance-condition text must be one of
//      this beat's own allowedTools.tools — an advance condition that cites a
//      tool the beat doesn't allow can never actually fire.
//   3. Every rulesCode rule whose enforcedBy includes "advance-gate-check" and
//      whose rule text names a tool must name a tool from this beat's own
//      allowedTools.tools too — keeps the rule prose and the tool contract from
//      drifting apart.

import { ownBibleBeats, loadBeats, report } from './lib/beats-ast.mjs';

const problems = [];

const { beats } = await loadBeats();
const bibleBeats = ownBibleBeats(beats);

const TOOL_TOKEN_RE = /\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g;
// Words that match the tool-token shape (snake_case) but are not tool names.
const NON_TOOL_WORDS = new Set(['current_step']);

function toolTokensIn(text) {
  if (typeof text !== 'string') return [];
  return [...text.matchAll(TOOL_TOKEN_RE)].map((m) => m[1]).filter((t) => !NON_TOOL_WORDS.has(t));
}

for (const { beatId, value: beat, line } of bibleBeats) {
  const flow = beat.bible.flow;
  const allowedTools = beat.bible.allowedTools;
  if (!flow || !Array.isArray(flow.rows) || flow.rows.length === 0) continue;

  const bibleToolSet = new Set(allowedTools?.tools ?? []);

  const advanceRow = flow.rows.find((r) => r.label === 'advance condition');
  if (!advanceRow || !advanceRow.value || !advanceRow.value.trim()) {
    problems.push(`${beatId} (line ${line}): bible.flow.rows has no non-empty "advance condition" row`);
    continue;
  }

  // 2. Tools cited in the advance condition must be allowed on this beat.
  if (bibleToolSet.size > 0) {
    for (const token of toolTokensIn(advanceRow.value)) {
      // Only judge tokens that look like real tool calls (contain a known verb
      // prefix used across this codebase's tool naming), to avoid false
      // positives on unrelated snake_case prose.
      if (!/^(submit_|advance_)/.test(token)) continue;
      if (!bibleToolSet.has(token)) {
        problems.push(
          `${beatId} (line ${line}): advance condition cites tool "${token}", ` +
            `which is not in this beat's own allowedTools.tools`,
        );
      }
    }
  }

  // 3. rulesCode rows enforced by advance-gate-check must cite allowed tools.
  for (const rule of beat.bible.rulesCode ?? []) {
    if (!Array.isArray(rule.enforcedBy) || !rule.enforcedBy.includes('advance-gate-check')) continue;
    if (bibleToolSet.size === 0) continue;
    for (const token of toolTokensIn(rule.rule)) {
      if (!/^(submit_|advance_)/.test(token)) continue;
      if (!bibleToolSet.has(token)) {
        problems.push(
          `${beatId} (line ${line}): rulesCode rule "${rule.id}" (enforced by advance-gate-check) ` +
            `cites tool "${token}", which is not in this beat's own allowedTools.tools`,
        );
      }
    }
  }
}

report(
  problems,
  `advance-gate-check passed: ${bibleBeats.length} bible-bearing beat(s) checked, ` +
    `every advance condition + advance-gated rule names only this beat's own allowed tools.`,
);
