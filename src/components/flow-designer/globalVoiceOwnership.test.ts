import { describe, it, expect } from 'vitest';
// PRODUCTION registry + sources.
import {
  validateGlobalVoiceOwnership,
  isLegalVoiceShape,
  validateGlobalResponses,
  validateGlobalRuleEffects,
  findGlobalRuleProseQuotes,
  // @ts-expect-error - plain .mjs check helper, no type declarations
} from '../../../scripts/checks/lib/globalVoiceOwnership.mjs';
import { GLOBAL_RULES, GLOBAL_VOICE_OWNERSHIP, TOOL_FAILURE, GLOBAL_RESPONSES } from './flowBible';
// The EXACT validators audio-ownership-check.mjs runs (one source of truth).

type GlobalRule = { id: string; effect?: unknown; [k: string]: unknown };

function rulesById(rules: readonly GlobalRule[]): Record<string, GlobalRule> {
  const out: Record<string, GlobalRule> = {};
  for (const r of rules) out[r.id] = { ...r };
  return out;
}

const baseRules = GLOBAL_RULES.rules as unknown as readonly GlobalRule[];

describe('F1-R: global dynamic-reply ownership is REQUIRED, not optional', () => {
  it('the healthy production sources pass with no problems', () => {
    const problems = validateGlobalVoiceOwnership({
      registry: GLOBAL_VOICE_OWNERSHIP,
      globalRulesById: rulesById(baseRules),
      toolFailure: TOOL_FAILURE,
    });
    expect(problems).toEqual([]);
  });

  it('every registry entry declares a legal voice shape', () => {
    for (const entry of GLOBAL_VOICE_OWNERSHIP) {
      expect(isLegalVoiceShape(entry.voice), `${entry.id} owner must be a legal shape`).toBe(true);
    }
  });

  // Negative (a): break the glob-out-of-scope owner's response link -> the check MUST
  // fail. Ownership is now structural (effect: { kind: 'response', responseId }), so a
  // rule that drops its response effect can no longer be a spoken owner.
  it('FAILS when GLOBAL_RULES.glob-out-of-scope loses its response-effect link', () => {
    const mutated = rulesById(baseRules);
    mutated['glob-out-of-scope'].effect = { kind: 'constraint' }; // no longer emits a response
    const problems = validateGlobalVoiceOwnership({
      registry: GLOBAL_VOICE_OWNERSHIP,
      globalRulesById: mutated,
      toolFailure: TOOL_FAILURE,
    });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(/glob-out-of-scope.*effect is not/i);
  });

  // Negative (b): remove / corrupt the TOOL_FAILURE owner -> the check MUST fail.
  it('FAILS when TOOL_FAILURE.voicePath.voice is corrupted', () => {
    const corrupted = {
      ...TOOL_FAILURE,
      voicePath: { ...TOOL_FAILURE.voicePath, voice: 'CORRUPTED: no declared owner' },
    };
    const problems = validateGlobalVoiceOwnership({
      registry: GLOBAL_VOICE_OWNERSHIP,
      globalRulesById: rulesById(baseRules),
      toolFailure: corrupted,
    });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(/TOOL_FAILURE\.voicePath\.voice.*not one of the four/i);
  });

  it('FAILS when the TOOL_FAILURE owner is removed entirely', () => {
    const stripped = { ...TOOL_FAILURE, voicePath: { line: 'x', voice: null } };
    const problems = validateGlobalVoiceOwnership({
      registry: GLOBAL_VOICE_OWNERSHIP,
      globalRulesById: rulesById(baseRules),
      toolFailure: stripped,
    });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(/TOOL_FAILURE\.voicePath carries no voice owner/i);
  });

  // Structural correspondence: a registry global-rule owner whose source rule links a
  // DIFFERENT response id MUST fail (the owner must emit the response of the same id).
  it('FAILS when the owning rule links a different response id than its owner id', () => {
    const mutated = rulesById(baseRules);
    mutated['glob-out-of-scope'].effect = { kind: 'response', responseId: 'some-other-id' };
    const problems = validateGlobalVoiceOwnership({
      registry: GLOBAL_VOICE_OWNERSHIP,
      globalRulesById: mutated,
      toolFailure: TOOL_FAILURE,
    });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(/glob-out-of-scope.*does not.*match its owner id/i);
  });
});

describe('B1-R2: typed effect discriminator + response-link resolution', () => {
  it('the healthy production rules pass (every rule carries a legal typed effect)', () => {
    const problems = validateGlobalRuleEffects({
      globalRules: GLOBAL_RULES.rules,
      responses: GLOBAL_RESPONSES,
      registry: GLOBAL_VOICE_OWNERSHIP,
    });
    expect(problems).toEqual([]);
  });

  it('FAILS when a global rule has no typed effect', () => {
    const withUntyped = [
      { id: 'glob-untyped', rule: 'A rule with no effect.' },
      ...GLOBAL_RULES.rules,
    ];
    const problems = validateGlobalRuleEffects({
      globalRules: withUntyped,
      responses: GLOBAL_RESPONSES,
      registry: GLOBAL_VOICE_OWNERSHIP,
    });
    expect(problems.join('\n')).toMatch(/glob-untyped.*missing or invalid typed effect/i);
  });

  it('FAILS when a response-effect responseId does not resolve to any GLOBAL_RESPONSES row', () => {
    const withDangling = [
      {
        id: 'glob-dangling',
        rule: 'Emits an undeclared response.',
        effect: { kind: 'response', responseId: 'no-such-row' },
      },
      ...GLOBAL_RULES.rules,
    ];
    const problems = validateGlobalRuleEffects({
      globalRules: withDangling,
      responses: GLOBAL_RESPONSES,
      registry: GLOBAL_VOICE_OWNERSHIP,
    });
    expect(problems.join('\n')).toMatch(
      /glob-dangling.*does not resolve to any GLOBAL_RESPONSES row/i,
    );
  });

  it('FAILS when a rule links a spoken response that has no GLOBAL_VOICE_OWNERSHIP owner', () => {
    // A spoken response present in GLOBAL_RESPONSES but absent from the registry: the
    // emitting rule links it, but it is unowned. (set-equality also catches the response
    // itself; here we prove the rule-side link check bites too.)
    const responses = [
      ...GLOBAL_RESPONSES,
      {
        id: 'glob-orphan',
        modality: 'spoken',
        line: 'x',
        voice: 'clip-family:onboard_orphan (pending recording)',
      },
    ];
    const rules = [
      {
        id: 'glob-orphan',
        rule: 'Emits an unowned spoken response.',
        effect: { kind: 'response', responseId: 'glob-orphan' },
      },
      ...GLOBAL_RULES.rules,
    ];
    const problems = validateGlobalRuleEffects({
      globalRules: rules,
      responses,
      registry: GLOBAL_VOICE_OWNERSHIP,
    });
    expect(problems.join('\n')).toMatch(/glob-orphan.*no GLOBAL_VOICE_OWNERSHIP owner/i);
  });
});

type GlobalResponse = { id: string; modality: string; line: string; voice?: string | null };

describe('B1-R: typed GLOBAL_RESPONSES ownership + set-equality with the registry', () => {
  const baseResponses = GLOBAL_RESPONSES as unknown as readonly GlobalResponse[];

  it('the healthy production responses pass with no problems', () => {
    const problems = validateGlobalResponses({
      responses: baseResponses,
      registry: GLOBAL_VOICE_OWNERSHIP,
    });
    expect(problems).toEqual([]);
  });

  it('FAILS when a spoken response carries no legal voice owner', () => {
    const mutated = baseResponses.map((r) =>
      r.id === 'tool-failure-voice' ? { ...r, voice: undefined } : { ...r },
    );
    const problems = validateGlobalResponses({
      responses: mutated,
      registry: GLOBAL_VOICE_OWNERSHIP,
    });
    expect(problems.join('\n')).toMatch(
      /tool-failure-voice.*modality 'spoken' but voice.*not one of the four legal shapes/i,
    );
  });

  it('FAILS when a spoken response lives outside the ownership registry', () => {
    const mutated = [
      ...baseResponses.map((r) => ({ ...r })),
      {
        id: 'glob-phantom-spoken',
        modality: 'spoken',
        line: 'Some prescribed global line.',
        voice: 'clip-family:onboard_phantom (pending recording)',
      },
    ];
    const problems = validateGlobalResponses({
      responses: mutated,
      registry: GLOBAL_VOICE_OWNERSHIP,
    });
    expect(problems.join('\n')).toMatch(
      /glob-phantom-spoken.*NO matching GLOBAL_VOICE_OWNERSHIP entry/i,
    );
  });

  it('FAILS when a registry owner has no declared spoken response', () => {
    const missing = baseResponses
      .filter((r) => r.id !== 'glob-out-of-scope')
      .map((r) => ({ ...r }));
    const problems = validateGlobalResponses({
      responses: missing,
      registry: GLOBAL_VOICE_OWNERSHIP,
    });
    expect(problems.join('\n')).toMatch(
      /glob-out-of-scope.*NO matching spoken GLOBAL_RESPONSES row/i,
    );
  });

  it('FAILS when a response voice disagrees with its owner', () => {
    const mutated = baseResponses.map((r) =>
      r.id === 'tool-failure-voice'
        ? { ...r, voice: 'clip-family:onboard_offtopic_steerback (pending recording)' }
        : { ...r },
    );
    const problems = validateGlobalResponses({
      responses: mutated,
      registry: GLOBAL_VOICE_OWNERSHIP,
    });
    expect(problems.join('\n')).toMatch(
      /tool-failure-voice.*disagrees with its GLOBAL_VOICE_OWNERSHIP/i,
    );
  });
});

describe('B1-R2: prose lint — a GlobalRule.rule may carry NO quoted string at all', () => {
  it('the healthy production global rules carry no quoted string in prose', () => {
    expect(findGlobalRuleProseQuotes(GLOBAL_RULES.rules)).toEqual([]);
  });

  it('FAILS on the exact Codex B1 probe (double-quoted line after a speech verb)', () => {
    const withProbe = [
      {
        id: 'glob-unregistered-spoken-probe',
        rule: 'On an unrecognized global input, say "Let us get back to your onboarding" and then re-ask the current question.',
      },
      ...GLOBAL_RULES.rules,
    ];
    const problems = findGlobalRuleProseQuotes(withProbe);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(
      /glob-unregistered-spoken-probe.*contains a quoted string/i,
    );
  });

  it('FAILS on the colon bypass (say: "...") — a quote is a quote', () => {
    const colon = [
      {
        id: 'glob-colon',
        rule: 'On unknown input, say: "Let us get back to your onboarding" then re-ask.',
      },
    ];
    expect(findGlobalRuleProseQuotes(colon).join('\n')).toMatch(
      /glob-colon.*contains a quoted string/i,
    );
  });

  it('FAILS on the single-quote bypass', () => {
    const single = [
      {
        id: 'glob-single',
        rule: "On unknown input, say 'Let us get back to your onboarding' then re-ask.",
      },
    ];
    expect(findGlobalRuleProseQuotes(single).join('\n')).toMatch(
      /glob-single.*contains a quoted string/i,
    );
  });

  it('FAILS on an in-prose USER-input example (quotes must move to inputExamples[])', () => {
    const inProse = [
      {
        id: 'glob-example',
        rule: 'Off-topic world questions ("who won the game yesterday"): steer back.',
      },
    ];
    expect(findGlobalRuleProseQuotes(inProse).join('\n')).toMatch(
      /glob-example.*contains a quoted string/i,
    );
  });

  it('does NOT fire on quote-free prose (examples live in inputExamples[])', () => {
    const clean = [
      {
        id: 'glob-machinery',
        rule: 'Never says beat, step, screen, page, card, tool, or system.',
      },
      {
        id: 'glob-scope',
        rule: 'Off-topic world questions: steer back with the beat own question.',
        inputExamples: ['who won the game yesterday'],
      },
    ];
    expect(findGlobalRuleProseQuotes(clean)).toEqual([]);
  });
});
