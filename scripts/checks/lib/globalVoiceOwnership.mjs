// Shared validator for the GLOBAL dynamic-reply ownership registry (F1-R).
//
// Used by BOTH scripts/checks/audio-ownership-check.mjs (lane d, over AST-parsed
// values) and src/components/flow-designer/globalVoiceOwnership.test.ts (over the
// imported TS values, mutated). One validator, so the committed negative tests
// exercise the exact logic the check runs.

// The four legal voice shapes (VOICE_OWNERSHIP, flowBible.ts).
const CLIP_RE = /^clip:[a-z0-9_]+$/;
const CLIP_FAMILY_RE = /^clip-family:[a-z0-9_]+ \(pending recording\)$/;
export function isLegalVoiceShape(v) {
  return (
    typeof v === 'string' &&
    (CLIP_RE.test(v) ||
      CLIP_FAMILY_RE.test(v) ||
      v === 'text-only' ||
      v === 'live-exception:name-greeting')
  );
}

// Validate the exhaustive global dynamic-reply ownership registry against the
// actual sources. Pure over plain objects, so tests can pass mutated copies.
//
//   registry:         GLOBAL_VOICE_OWNERSHIP array (owner declarations)
//   globalRulesById:  { [id]: GlobalRule } from GLOBAL_RULES.rules
//   toolFailure:      TOOL_FAILURE object (reads .voicePath.voice)
//
// Every registry entry MUST resolve to a real, legal-shape owner at its source.
// A missing/removed owner (glob-out-of-scope.voice deleted) or a corrupt one
// (TOOL_FAILURE.voicePath.voice mangled) MUST fail. Any GLOBAL rule carrying a
// voice field that is NOT in the registry MUST fail (no unregistered spoken global).
export function validateGlobalVoiceOwnership({ registry, globalRulesById, toolFailure }) {
  const problems = [];

  if (!Array.isArray(registry) || registry.length === 0) {
    problems.push(
      'GLOBAL_VOICE_OWNERSHIP registry is empty or missing — every global dynamic spoken response must be declared and owned',
    );
    return problems;
  }

  const registeredRuleIds = new Set();

  for (const entry of registry) {
    const label = `GLOBAL_VOICE_OWNERSHIP "${entry?.id ?? '(no id)'}"`;
    // The registry entry itself must declare a legal-shape owner.
    if (!isLegalVoiceShape(entry?.voice)) {
      problems.push(
        `${label}: registry voice "${entry?.voice}" is not one of the four legal shapes`,
      );
    }

    if (entry?.kind === 'global-rule') {
      registeredRuleIds.add(entry.id);
      const rule = globalRulesById?.[entry.id];
      if (!rule) {
        problems.push(
          `${label}: declares GLOBAL_RULES.${entry.id} owned, but no such global rule exists`,
        );
      } else if (rule.voice === undefined || rule.voice === null) {
        problems.push(
          `${label}: GLOBAL_RULES.${entry.id} is declared spoken/owned but carries NO voice field ` +
            `(VOICE_OWNERSHIP: every spoken global reply must be owned)`,
        );
      } else if (!isLegalVoiceShape(rule.voice)) {
        problems.push(
          `${label}: GLOBAL_RULES.${entry.id} voice "${rule.voice}" is not one of the four legal shapes`,
        );
      }
    } else if (entry?.kind === 'tool-failure') {
      const vp = toolFailure?.voicePath;
      if (!vp || vp.voice === undefined || vp.voice === null) {
        problems.push(
          `${label}: TOOL_FAILURE.voicePath carries no voice owner ` +
            `(the dynamic tool-failure coach line must be owned)`,
        );
      } else if (!isLegalVoiceShape(vp.voice)) {
        problems.push(
          `${label}: TOOL_FAILURE.voicePath.voice "${vp.voice}" is not one of the four legal shapes`,
        );
      }
    } else {
      problems.push(`${label}: unknown ownership kind "${entry?.kind}"`);
    }
  }

  // Exhaustiveness: any GLOBAL rule that carries a voice field must be registered,
  // so a newly-added spoken global cannot escape the ownership requirement.
  for (const [id, rule] of Object.entries(globalRulesById ?? {})) {
    if (rule && rule.voice !== undefined && rule.voice !== null && !registeredRuleIds.has(id)) {
      problems.push(
        `GLOBAL_RULES.${id} carries a voice field but is NOT declared in GLOBAL_VOICE_OWNERSHIP ` +
          `(every spoken global rule must be registered and owned)`,
      );
    }
  }

  return problems;
}

// ---- B1-R: typed global dynamic-response ownership (GLOBAL_RESPONSES) ----
//
// The typed GLOBAL_RESPONSES declaration is the ONLY permitted source for global
// dynamic response copy. This validator enforces, over plain objects (so the Vitest
// test can pass mutated copies), the three B1-R contracts:
//   1. every `modality: 'spoken'` row carries a legal-shape voice owner;
//   2. SET-EQUALITY between the spoken responses and GLOBAL_VOICE_OWNERSHIP (every
//      spoken response is owned; every owner has a declared spoken response; no spoken
//      response lives outside the registry) with per-id voice agreement;
//   3. unknown modality values are rejected.
export function validateGlobalResponses({ responses, registry }) {
  const problems = [];

  if (!Array.isArray(responses)) {
    problems.push(
      'GLOBAL_RESPONSES is missing or not an array — the typed global dynamic-response declaration is required (B1-R)',
    );
    return problems;
  }

  const spokenIds = new Set();
  const spokenVoiceById = new Map();

  for (const resp of responses) {
    const label = `GLOBAL_RESPONSES "${resp?.id ?? '(no id)'}"`;
    if (resp?.modality === 'spoken') {
      if (!resp.id) {
        problems.push(
          `${label}: a spoken response must carry an id matching its GLOBAL_VOICE_OWNERSHIP owner`,
        );
      } else {
        spokenIds.add(resp.id);
        spokenVoiceById.set(resp.id, resp.voice);
      }
      if (!isLegalVoiceShape(resp?.voice)) {
        problems.push(
          `${label}: modality 'spoken' but voice "${resp?.voice}" is not one of the four legal shapes ` +
            `(every spoken global response must be owned)`,
        );
      }
    } else if (resp?.modality === 'text-only') {
      // A text-only declared response carries no voice owner by definition — fine.
    } else {
      problems.push(`${label}: unknown modality "${resp?.modality}" (must be 'spoken' or 'text-only')`);
    }
  }

  // SET-EQUALITY with the ownership registry.
  const registeredIds = new Set(
    Array.isArray(registry) ? registry.map((e) => e?.id).filter(Boolean) : [],
  );
  for (const id of spokenIds) {
    if (!registeredIds.has(id)) {
      problems.push(
        `GLOBAL_RESPONSES spoken response "${id}" has NO matching GLOBAL_VOICE_OWNERSHIP entry ` +
          `(a spoken response outside the ownership registry is unowned)`,
      );
    }
  }
  for (const id of registeredIds) {
    if (!spokenIds.has(id)) {
      problems.push(
        `GLOBAL_VOICE_OWNERSHIP entry "${id}" has NO matching spoken GLOBAL_RESPONSES row ` +
          `(every owned global reply must declare its typed spoken response)`,
      );
    }
  }

  // Per-id voice agreement between the typed response and its declared owner.
  if (Array.isArray(registry)) {
    for (const entry of registry) {
      if (!entry?.id || !spokenVoiceById.has(entry.id)) continue;
      const rv = spokenVoiceById.get(entry.id);
      if (rv !== entry.voice) {
        problems.push(
          `GLOBAL_RESPONSES "${entry.id}" voice "${rv}" disagrees with its GLOBAL_VOICE_OWNERSHIP ` +
            `owner "${entry.voice}"`,
        );
      }
    }
  }

  return problems;
}

// ---- B1-R: prose lint — a GlobalRule.rule must not hide a spoken coach line ----
//
// A quoted line (>2 words) that appears after a speech verb (say/reply/respond/tell/
// speak/utter/answer, and inflections) inside a GlobalRule.rule is a prescribed spoken
// coach line hidden in free-text prose. This is the exact Codex B1 attack shape
// (`... say "Let us get back to your onboarding" ...`). Global dynamic response copy
// must live in the typed GLOBAL_RESPONSES declaration and be owned, so this is rejected.
//
// It is deliberately anchored on a QUOTE preceded by a SPEECH VERB, so it does NOT fire
// on a rule that quotes a USER-input EXAMPLE (glob-out-of-scope's "who won the game
// yesterday", glob-invalid-value's "my gender is yellow" — those follow nouns like
// "questions"/"values", not a speech verb), nor on a speech verb with no quote
// (glob-no-machinery's "Never says beat...", glob-ack-where-declared's "speak the
// recorded acknowledgment line").
const SPEECH_VERB_QUOTE_RE =
  /\b(say|says|said|saying|reply|replies|replied|respond|responds|responded|tell|tells|told|speak|speaks|spoke|spoken|utter|utters|uttered|answer|answers|answered)\b(?:\s+\w+){0,3}\s*["“]([^"”]+)["”]/i;

export function findGlobalRuleProseSpokenLines(globalRulesArr) {
  const problems = [];
  if (!Array.isArray(globalRulesArr)) return problems;
  for (const rule of globalRulesArr) {
    const text = rule && typeof rule.rule === 'string' ? rule.rule : '';
    if (!text) continue;
    const m = SPEECH_VERB_QUOTE_RE.exec(text);
    if (!m) continue;
    const inner = (m[2] ?? '').trim();
    if (inner.split(/\s+/).filter(Boolean).length <= 2) continue;
    problems.push(
      `GLOBAL_RULES "${rule.id}": rule prose prescribes a spoken coach line ("${inner}") in free text ` +
        `(a quoted line after the speech verb "${m[1]}"). Global dynamic response copy must live in the typed ` +
        `GLOBAL_RESPONSES declaration and be owned in GLOBAL_VOICE_OWNERSHIP — a spoken line may not hide in rule prose (B1-R).`,
    );
  }
  return problems;
}
