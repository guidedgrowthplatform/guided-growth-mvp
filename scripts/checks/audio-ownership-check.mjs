// Registry id: audio-ownership-check
// Meaning (ENFORCER_REGISTRY, flowBible.ts): voice ownership across FOUR lanes
// (VOICE_OWNERSHIP, flowBible.ts). The Yair rule mechanized: every dynamic coach
// reply is clip-owned, declared text-only, or THE one name-greeting live
// exception. No unowned spoken line anywhere.
//
// Lane a (script perLine, category-women / goals-sleep / profile-asks): every
//   spoken line's `resolvesTo` names a recorded clip or a silent reveal, and
//   `liveAllowed` is the machine-checkable flag:
//   1. A resolvesTo carrying the live `{name}` slot must have liveAllowed 'YES'.
//   2. A resolvesTo with no `{name}` slot, not a silent/no-audio reveal, must
//      have liveAllowed 'NO' exactly.
//   3. perLine must cover every spoken script seq and reference no missing seq.
// Lane b (section-13 conversation branches): every spoken branch reply carries a
//   `voice` field in one of the five legal shapes.
// Lane c (edge rows): every edge whose `behavior` contains a quoted spoken coach
//   line carries a legal `voice` field.
// Lane d (flowBible.ts global rules): any GlobalRule carrying a `voice` field has
//   a legal shape.
//
// The five legal shapes (any voice field, all lanes):
//   'clip:<id>' | 'clip-family:<family> (pending recording)' |
//   'clip-family:<family> (recorded, <n> clips)' |
//   'text-only' | 'live-exception:name-greeting'

import ts from 'typescript';
import {
  ownBibleBeats,
  loadBeats,
  loadSourceFile,
  literalValue,
  lineOf,
  FLOWBIBLE_PATH,
  report,
} from './lib/beats-ast.mjs';
import {
  isLegalVoiceShape,
  validateGlobalVoiceOwnership,
  validateGlobalResponses,
  validateGlobalRuleEffects,
  findGlobalRuleProseQuotes,
} from './lib/globalVoiceOwnership.mjs';

const problems = [];

// The five-shape voice validator (isLegalVoiceShape) is shared by every lane and
// by the global-ownership validator, imported from ./lib/globalVoiceOwnership.mjs.

// Lane b: conservative — a branch reply is SPOKEN unless it clearly denotes
// silence / no coach speech.
const SILENCE_RE = /\bsilent\b|no reply|no coach line|no coach speech|no spoken line/i;
function isSpokenReply(reply) {
  return typeof reply === 'string' && reply.trim().length > 0 && !SILENCE_RE.test(reply);
}

// Lane c: a double- or curly-quoted substring of >2 words = a quoted spoken line.
const QUOTE_RE = /"([^"]+)"|“([^”]+)”/g;
function hasQuotedSpokenLine(behavior) {
  if (typeof behavior !== 'string') return false;
  QUOTE_RE.lastIndex = 0;
  let m;
  while ((m = QUOTE_RE.exec(behavior)) !== null) {
    const inner = (m[1] ?? m[2] ?? '').trim();
    if (inner.split(/\s+/).filter(Boolean).length > 2) return true;
  }
  return false;
}

const { beats } = await loadBeats();
const bibleBeats = ownBibleBeats(beats);

// --- Lane a: script perLine ---
const LIVE_SLOT_RE = /\{name\}/;
const SILENT_RE = /no audio|silent reveal|n\/a/i;

for (const { beatId, value: beat, line } of bibleBeats) {
  const voice = beat.bible.voice;
  if (!voice || !Array.isArray(voice.perLine) || voice.perLine.length === 0) continue;

  const script = Array.isArray(beat.script) ? beat.script : [];
  const scriptSeqs = new Set(script.map((s) => s.seq));
  const spokenSeqs = new Set(script.filter((s) => s.voice !== null).map((s) => s.seq));
  const perLineSeqs = new Set();

  for (const perLine of voice.perLine) {
    perLineSeqs.add(perLine.seq);

    if (!scriptSeqs.has(perLine.seq)) {
      problems.push(
        `${beatId} (line ${line}): voice.perLine references seq ${perLine.seq}, ` +
          `which does not exist in this beat's script[]`,
      );
      continue;
    }

    const resolvesTo = perLine.resolvesTo ?? '';
    const liveAllowed = perLine.liveAllowed ?? '';
    const isLiveSlot = LIVE_SLOT_RE.test(resolvesTo);
    const isSilent = SILENT_RE.test(resolvesTo);

    if (isLiveSlot) {
      if (!/^yes$/i.test(liveAllowed)) {
        problems.push(
          `${beatId} (line ${line}) seq ${perLine.seq}: resolvesTo carries a live {name} slot ` +
            `but liveAllowed is "${liveAllowed}" (must be YES)`,
        );
      }
    } else if (!isSilent) {
      if (!/^no$/i.test(liveAllowed)) {
        problems.push(
          `${beatId} (line ${line}) seq ${perLine.seq}: resolvesTo ("${resolvesTo}") has no {name} ` +
            `slot, so it must resolve to a fixed clip — liveAllowed is "${liveAllowed}", must be NO`,
        );
      }
    }
  }

  // 3. Coverage: every spoken script line needs a perLine entry.
  for (const seq of spokenSeqs) {
    if (!perLineSeqs.has(seq)) {
      problems.push(
        `${beatId} (line ${line}): script seq ${seq} has voice audio but no matching voice.perLine entry`,
      );
    }
  }
}

// --- Lane b: section-13 conversation branches ---
let branchesChecked = 0;
for (const { beatId, value: beat, line } of bibleBeats) {
  const conversation = beat.bible.conversation;
  if (!conversation || !Array.isArray(conversation.branches)) continue;
  conversation.branches.forEach((branch, i) => {
    if (!isSpokenReply(branch.reply)) return;
    branchesChecked += 1;
    const voice = branch.voice;
    if (voice === undefined || voice === null) {
      problems.push(
        `${beatId} (line ${line}) conversation branch ${i + 1} ("${branch.on}"): spoken reply ` +
          `carries no voice field (VOICE_OWNERSHIP: every spoken coach reply must be owned)`,
      );
    } else if (!isLegalVoiceShape(voice)) {
      problems.push(
        `${beatId} (line ${line}) conversation branch ${i + 1} ("${branch.on}"): voice ` +
          `"${voice}" is not one of the five legal shapes`,
      );
    }
  });
}

// --- Lane c: edge rows with a quoted spoken line ---
let edgesChecked = 0;
for (const { beatId, value: beat, line } of bibleBeats) {
  const edges = beat.bible.edges;
  if (!edges || !Array.isArray(edges.rows)) continue;
  edges.rows.forEach((row, i) => {
    if (!hasQuotedSpokenLine(row.behavior)) return;
    edgesChecked += 1;
    const voice = row.voice;
    if (voice === undefined || voice === null) {
      problems.push(
        `${beatId} (line ${line}) edge ${i + 1} ("${row.edge}"): behavior quotes a spoken coach ` +
          `line but carries no voice field (VOICE_OWNERSHIP)`,
      );
    } else if (!isLegalVoiceShape(voice)) {
      problems.push(
        `${beatId} (line ${line}) edge ${i + 1} ("${row.edge}"): voice "${voice}" is not one of ` +
          `the five legal shapes`,
      );
    }
  });
}

// --- Lane d + e: flowBible.ts GLOBAL dynamic-reply ownership (F1-R) ---
// Parallel AST read of flowBible (beats-ast loadBeats parses only beatsSource).
// Generic loader: find a top-level `export const <name> = <literal>` and return
// its literalValue.
async function loadFlowBibleConsts(names) {
  const sf = await loadSourceFile(FLOWBIBLE_PATH);
  const out = {};
  const lines = {};
  (function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      names.includes(node.name.text) &&
      node.initializer
    ) {
      const init = ts.isAsExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      out[node.name.text] = literalValue(init);
      lines[node.name.text] = lineOf(sf, node);
      return;
    }
    ts.forEachChild(node, visit);
  })(sf);
  return { out, lines };
}

const { out: fbConsts } = await loadFlowBibleConsts([
  'GLOBAL_RULES',
  'GLOBAL_VOICE_OWNERSHIP',
  'TOOL_FAILURE',
  'GLOBAL_RESPONSES',
]);

const globalRulesArr = Array.isArray(fbConsts.GLOBAL_RULES?.rules)
  ? fbConsts.GLOBAL_RULES.rules
  : null;
if (!globalRulesArr) throw new Error('Could not find GLOBAL_RULES.rules in flowBible.ts');
const registry = fbConsts.GLOBAL_VOICE_OWNERSHIP;
if (!Array.isArray(registry))
  throw new Error('Could not find GLOBAL_VOICE_OWNERSHIP in flowBible.ts (F1-R registry required)');
const toolFailure = fbConsts.TOOL_FAILURE ?? null;

const globalRulesById = {};
for (const rule of globalRulesArr) {
  if (rule && rule.id) globalRulesById[rule.id] = rule;
}

// Lane d (F1-R): the exhaustive ownership REQUIREMENT. Every declared global
// dynamic spoken response (registry entry) must resolve to a real, legal owner at
// its source. For a 'global-rule' owner the source rule must EMIT the response of the
// same id via its typed effect; for a 'tool-failure' owner TOOL_FAILURE.voicePath must
// carry the owner. Removing the owner, or corrupting TOOL_FAILURE.voicePath.voice, fails.
const ownershipProblems = validateGlobalVoiceOwnership({
  registry,
  globalRulesById,
  toolFailure,
});
for (const p of ownershipProblems) problems.push(p);

// Lane e (B1-R): the TYPED global response declaration (GLOBAL_RESPONSES) is the only
// permitted source of global dynamic response copy. Every modality:'spoken' row must
// carry a legal owner, every row id is unique, and the spoken-response set must EQUAL
// GLOBAL_VOICE_OWNERSHIP (no spoken response outside the registry; no owner without a
// declared response).
const globalResponses = fbConsts.GLOBAL_RESPONSES;
if (!Array.isArray(globalResponses))
  throw new Error('Could not find GLOBAL_RESPONSES in flowBible.ts (B1-R typed response declaration required)');
const responseProblems = validateGlobalResponses({ responses: globalResponses, registry });
for (const p of responseProblems) problems.push(p);

// Lane f (B1-R2): the STRUCTURAL ownership boundary. Every GlobalRule declares a typed
// effect; an emitting rule ({ kind:'response', responseId }) must link exactly one
// GLOBAL_RESPONSES row, and a spoken linked row must be owned. This is what makes
// ownership non-inferable and non-bypassable: response copy has nowhere to live except a
// resolved, owned row. Replaces the old speaker-inference on rule prose.
const effectProblems = validateGlobalRuleEffects({
  globalRules: globalRulesArr,
  responses: globalResponses,
  registry,
});
for (const p of effectProblems) problems.push(p);

// Lane g (B1-R2): a GlobalRule.rule prose must carry NO quoted string at all. The exact
// Codex B1 probe and every punctuation-shape mutation of it (colon, single quote,
// parentheses, >3 intervening words) put a quote in the prose, so all are rejected with
// no speaker inference. Legitimate quotes live in inputExamples[] / GLOBAL_RESPONSES.
const proseProblems = findGlobalRuleProseQuotes(globalRulesArr);
for (const p of proseProblems) problems.push(p);

const spokenResponses = globalResponses.filter((r) => r?.modality === 'spoken').length;
const emittingRules = globalRulesArr.filter((r) => r?.effect?.kind === 'response').length;
report(
  problems,
  `audio-ownership-check passed (7 lanes): ${bibleBeats.length} bible-bearing beat(s); ` +
    `lane a perLine ownership holds; lane b ${branchesChecked} spoken branch reply(ies) owned; ` +
    `lane c ${edgesChecked} quoted-spoken edge(s) owned; ` +
    `lane d ${registry.length} global dynamic reply(ies) required-owned (registry-exhaustive); ` +
    `lane e ${spokenResponses} typed spoken response(s) owned + unique-id + set-equal to the registry; ` +
    `lane f ${globalRulesArr.length} global rule(s) carry a typed effect (${emittingRules} emit a linked, owned response); ` +
    `lane g ${globalRulesArr.length} global rule(s) prose-linted (no quoted string in rule prose).`,
);
