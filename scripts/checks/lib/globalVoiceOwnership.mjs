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
