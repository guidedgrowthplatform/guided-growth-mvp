// Registry id: tool-contract-check
// Meaning (ENFORCER_REGISTRY, flowBible.ts): "beat tools match the app tool
// registry + arg schemas".
//
// There is no standalone app-side tool registry file yet (the app consumes
// tool calls at runtime; the render's bible.allowedTools section is the
// authored SPEC of what a beat may call). Until that app-side artifact exists,
// this check enforces the cross-checkable half: every place a beat's own
// authored source NAMES a tool must agree with every other place it names one.
// A beat is only as enforceable as its own internal consistency; this closes
// the three concrete drift paths visible in beatsSource.ts today:
//   1. The top-level `allowedTools` comma string (BeatEntry.allowedTools) and
//      bible.allowedTools.tools (the array) must name the exact same set of
//      tools. Two authored representations of the same fact silently drifting
//      is precisely what an unenforced "planned" check misses.
//   2. Every bible.allowedTools.specs[].tool must be one of the beat's own
//      allowedTools.tools (no orphan arg schema for a tool the beat doesn't
//      allow).
//   3. Every `tool:<name>` cited in bible.conversation.branches[].then must be
//      one of the beat's own allowedTools.tools — a conversation branch that
//      calls a tool the beat never declares would be an un-runnable contract.

import { ownBibleBeats, loadBeats, report } from './lib/beats-ast.mjs';

const problems = [];

const { beats } = await loadBeats();
const bibleBeats = ownBibleBeats(beats);

function parseCommaTools(str) {
  if (typeof str !== 'string' || str.trim().length === 0) return [];
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

for (const { beatId, value: beat, line } of bibleBeats) {
  const allowedTools = beat.bible.allowedTools;
  if (!allowedTools || !Array.isArray(allowedTools.tools) || allowedTools.tools.length === 0) continue;

  const bibleToolSet = new Set(allowedTools.tools);
  const topLevelToolSet = new Set(parseCommaTools(beat.allowedTools));

  // 1. Top-level BeatEntry.allowedTools string vs bible.allowedTools.tools.
  if (topLevelToolSet.size > 0 && !setsEqual(topLevelToolSet, bibleToolSet)) {
    problems.push(
      `${beatId} (line ${line}): top-level allowedTools "${beat.allowedTools}" ` +
        `does not match bible.allowedTools.tools [${allowedTools.tools.join(', ')}]`,
    );
  }

  // 2. Every tool spec must name an allowed tool.
  for (const spec of allowedTools.specs ?? []) {
    if (!bibleToolSet.has(spec.tool)) {
      problems.push(
        `${beatId} (line ${line}): allowedTools.specs names tool "${spec.tool}", ` +
          `which is not in this beat's own allowedTools.tools`,
      );
    }
  }

  // 3. Every tool: branch in the conversation model must name an allowed tool.
  const conversation = beat.bible.conversation;
  for (const branch of conversation?.branches ?? []) {
    const match = typeof branch.then === 'string' && branch.then.match(/^tool:(.+)$/);
    if (match) {
      const toolName = match[1].trim();
      if (!bibleToolSet.has(toolName)) {
        problems.push(
          `${beatId} (line ${line}): conversation branch calls "tool:${toolName}", ` +
            `which is not in this beat's own allowedTools.tools`,
        );
      }
    }
  }
}

report(
  problems,
  `tool-contract-check passed: ${bibleBeats.length} bible-bearing beat(s) checked, ` +
    `allowedTools string/array/specs/conversation-branches all name the same tool set.`,
);
