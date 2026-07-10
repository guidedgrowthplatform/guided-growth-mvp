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

  for (const entry of registry) {
    const label = `GLOBAL_VOICE_OWNERSHIP "${entry?.id ?? '(no id)'}"`;
    // The registry entry itself must declare a legal-shape owner.
    if (!isLegalVoiceShape(entry?.voice)) {
      problems.push(
        `${label}: registry voice "${entry?.voice}" is not one of the four legal shapes`,
      );
    }

    if (entry?.kind === 'global-rule') {
      const rule = globalRulesById?.[entry.id];
      // Ownership is now STRUCTURAL: the owning rule must exist and EMIT the response of
      // the same id via its typed effect (B1-R2). The response's voice legality + per-id
      // agreement with this registry are enforced in validateGlobalResponses; the link
      // resolution is enforced in validateGlobalRuleEffects. Here we only pin the rule
      // -> owner correspondence.
      if (!rule) {
        problems.push(
          `${label}: declares GLOBAL_RULES.${entry.id} owned, but no such global rule exists`,
        );
      } else if (!rule.effect || rule.effect.kind !== 'response') {
        problems.push(
          `${label}: GLOBAL_RULES.${entry.id} is declared spoken/owned but its effect is not ` +
            `{ kind: 'response', responseId } (a rule that owns a spoken global response must ` +
            `EMIT it via a typed response effect — VOICE_OWNERSHIP)`,
        );
      } else if (rule.effect.responseId !== entry.id) {
        problems.push(
          `${label}: GLOBAL_RULES.${entry.id}.effect.responseId "${rule.effect.responseId}" does not ` +
            `match its owner id "${entry.id}" (the owning rule must link the response of the same id)`,
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

  // Exhaustiveness (a rule that EMITS a spoken response but is not registered) is now
  // enforced structurally in validateGlobalRuleEffects, which has GLOBAL_RESPONSES in
  // scope to tell spoken from text-only.
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
  const seenIds = new Set();

  for (const resp of responses) {
    const label = `GLOBAL_RESPONSES "${resp?.id ?? '(no id)'}"`;
    // Row-id UNIQUENESS: a Map/Set overwrite would silently let two rows share an id
    // (last one wins), making the copy source ambiguous. Reject any duplicate id.
    if (resp?.id) {
      if (seenIds.has(resp.id)) {
        problems.push(
          `${label}: duplicate id — every GLOBAL_RESPONSES row id must be unique ` +
            `(two rows with the same id make the owned copy source ambiguous)`,
        );
      } else {
        seenIds.add(resp.id);
      }
    }
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

// ---- B1-R2: typed effect discriminator + response-link resolution ----
//
// Every GlobalRule declares a TYPED `effect`. This replaces inferring "does this rule
// emit a response?" from prose. Enforced:
//   - `effect` is present and legal: { kind:'constraint' } | { kind:'response', responseId }.
//   - a 'constraint' effect carries no responseId.
//   - a 'response' effect names a responseId that resolves to EXACTLY ONE GLOBAL_RESPONSES
//     row; if that row is spoken, the rule must be an owner in GLOBAL_VOICE_OWNERSHIP.
// Because a response's copy can live ONLY in a GLOBAL_RESPONSES row (rule prose is quote-
// free, lane g), a rule cannot introduce owned-looking or spoken copy without a resolved,
// owned response — no punctuation-shape bypass exists.
export function validateGlobalRuleEffects({ globalRules, responses, registry }) {
  const problems = [];
  if (!Array.isArray(globalRules)) {
    problems.push('GLOBAL_RULES.rules is missing or not an array (B1-R2 typed-effect check)');
    return problems;
  }
  const responseById = new Map();
  if (Array.isArray(responses)) {
    for (const r of responses) {
      // Duplicate ids are rejected by validateGlobalResponses; index first-wins here
      // only for link resolution.
      if (r && typeof r.id === 'string' && !responseById.has(r.id)) responseById.set(r.id, r);
    }
  }
  const registeredIds = new Set(
    Array.isArray(registry) ? registry.map((e) => e?.id).filter(Boolean) : [],
  );

  // Rule-id UNIQUENESS (mirrors the GLOBAL_RESPONSES dup-id check in
  // validateGlobalResponses): a duplicate GLOBAL_RULES id would make precedence and
  // spoken-response ownership ambiguous (two rules could each claim to own the id).
  const seenRuleIds = new Set();
  for (const rule of globalRules) {
    const label = `GLOBAL_RULES "${rule?.id ?? '(no id)'}"`;
    if (rule?.id) {
      if (seenRuleIds.has(rule.id)) {
        problems.push(
          `${label}: duplicate id — every GLOBAL_RULES rule id must be unique ` +
            `(two rules with the same id make precedence and ownership ambiguous)`,
        );
      } else {
        seenRuleIds.add(rule.id);
      }
    }
    const effect = rule?.effect;
    if (
      !effect ||
      typeof effect !== 'object' ||
      (effect.kind !== 'constraint' && effect.kind !== 'response')
    ) {
      problems.push(
        `${label}: missing or invalid typed effect discriminator ` +
          `(every global rule must declare effect: { kind: 'constraint' } or { kind: 'response', responseId })`,
      );
      continue;
    }
    if (effect.kind === 'constraint') {
      if (effect.responseId !== undefined && effect.responseId !== null) {
        problems.push(`${label}: effect.kind 'constraint' must NOT carry a responseId`);
      }
      continue;
    }
    // effect.kind === 'response'
    const rid = effect.responseId;
    if (typeof rid !== 'string' || rid.length === 0) {
      problems.push(
        `${label}: effect.kind 'response' must carry a non-empty responseId naming a GLOBAL_RESPONSES row`,
      );
      continue;
    }
    const resp = responseById.get(rid);
    if (!resp) {
      problems.push(
        `${label}: effect.responseId "${rid}" does not resolve to any GLOBAL_RESPONSES row ` +
          `(an output-producing global rule must reference exactly one declared, owned response)`,
      );
      continue;
    }
    if (resp.modality === 'spoken' && !registeredIds.has(rid)) {
      problems.push(
        `${label}: links spoken response "${rid}" but that response has no GLOBAL_VOICE_OWNERSHIP owner ` +
          `(every spoken global response must be owned)`,
      );
    }
  }
  return problems;
}

// ---- B1-R2: prose lint — a GlobalRule.rule must carry NO quoted string at all ----
//
// STRUCTURAL replacement for the old speech-verb-plus-quote regex (which Codex proved
// bypassable with a colon, single quotes, parentheses, or >3 intervening words). Since
// every legitimate quote now lives in a typed field — a user-input example in
// `inputExamples`, a prescribed coach line in the GLOBAL_RESPONSES row named by `effect`
// — NO quoted string belongs in behavior prose. So the rule is: reject ANY double- or
// single-quoted string, with no attempt to infer who speaks it. This removes all speaker
// inference and closes every punctuation-shape bypass class at once.
//
// (This lint applies ONLY to the GLOBAL layer GlobalRule.rule prose. Per-beat rulesContext
// / rulesCode rule prose is not global response copy and is out of its scope.)
// Glyph completeness (QA hardening, 2026-07-11) — PROPERTY-BASED, not an enumerated glyph
// list. The prior fix chased quote glyphs one at a time (straight/curly double, backtick,
// guillemets, then CJK corners, fullwidth, primes ...), so every QA cycle reopened a
// whack-a-mole when it found one more exotic quote the enumerated class missed. Instead, a
// character is an UNCONDITIONAL quote if it carries the Unicode Quotation_Mark property OR
// is in a small extra set the property does not cover (backtick, the primes, the modifier
// apostrophes), with ONE exception: the two apostrophe-capable code points U+0027 (') and
// U+2019 (’). Those legitimately appear as apostrophes in constraint prose (the user's,
// don't, users’), so they are NOT flagged on occurrence; they are deferred to
// SINGLE_QUOTE_PAIR_RE and fail only when they form a word-boundary-anchored PAIR. Every
// other quote-like glyph — present or future, however exotic — is caught by the property
// test with no list left to extend, which is what ends the loop. (\p{Quotation_Mark}
// already covers " “ ” ‘ ‚ ‛ „ « » ‹ › 「 」 『 』 〝 〞 〟 ＂ ＇ ｢ ｣ and the two excluded
// apostrophes; it does NOT cover backtick, the primes, or the modifier apostrophes, hence
// the extra set.)
const UNCONDITIONAL_QUOTE_RE = /[\p{Quotation_Mark}`′″‴ʼʻ]/gu; // any Quotation_Mark or extra-set glyph; the two apostrophe-capable code points (U+0027, U+2019) are excluded at match time and deferred to SINGLE_QUOTE_PAIR_RE
const SINGLE_QUOTE_PAIR_RE = /(?<!\w)['’](?:[^'’\n]|(?<=\w)['’](?=\w))*['’](?!\w)/; // a straight/curly single-quote PAIR (' and ’, the apostrophe-capable pair), word-boundary anchored so a mid-word apostrophe is never mistaken for a quote; interior apostrophes are consumable only when mid-word, so a real quoted pair still matches across a contraction while legit possessive/contraction prose is never flagged. No length cap.

export function findGlobalRuleProseQuotes(globalRulesArr) {
  const problems = [];
  if (!Array.isArray(globalRulesArr)) return problems;
  for (const rule of globalRulesArr) {
    const text = rule && typeof rule.rule === 'string' ? rule.rule : '';
    if (!text) continue;
    // Unconditional quote-glyph scan: any Quotation_Mark / extra-set glyph that is NOT one
    // of the two apostrophe-capable code points (U+0027, U+2019) is a violation on ANY
    // occurrence. Those two are deferred to the pair check below.
    let dqAt = -1;
    UNCONDITIONAL_QUOTE_RE.lastIndex = 0;
    for (let m = UNCONDITIONAL_QUOTE_RE.exec(text); m; m = UNCONDITIONAL_QUOTE_RE.exec(text)) {
      const cp = m[0].codePointAt(0);
      if (cp !== 0x27 && cp !== 0x2019) {
        dqAt = m.index;
        break;
      }
    }
    const sq = SINGLE_QUOTE_PAIR_RE.exec(text);
    if (dqAt === -1 && !sq) continue;
    // Report the earliest offending glyph (unconditional glyph or the anchored pair).
    const at = dqAt === -1 || (sq && sq.index < dqAt) ? sq.index : dqAt;
    const snippet = text.slice(at, at + 80).replace(/\s+/g, ' ').trim();
    problems.push(
      `GLOBAL_RULES "${rule.id}": rule prose contains a quoted string ("${snippet}"). Behavior prose ` +
        `must carry NO quotes — put a user-input example in inputExamples[], and a prescribed coach line in ` +
        `the GLOBAL_RESPONSES row named by effect. This removes speaker inference and closes the colon / ` +
        `single-quote / parenthesis / >3-word bypass classes (B1-R2).`,
    );
  }
  return problems;
}
