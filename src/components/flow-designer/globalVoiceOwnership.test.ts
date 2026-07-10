import { describe, it, expect } from 'vitest';
// PRODUCTION registry + sources.
import {
  validateGlobalVoiceOwnership,
  isLegalVoiceShape,
  validateGlobalResponses,
  findGlobalRuleProseSpokenLines,
  // @ts-expect-error - plain .mjs check helper, no type declarations
} from '../../../scripts/checks/lib/globalVoiceOwnership.mjs';
import { GLOBAL_RULES, GLOBAL_VOICE_OWNERSHIP, TOOL_FAILURE, GLOBAL_RESPONSES } from './flowBible';
// The EXACT validator audio-ownership-check.mjs lane e runs (one source of truth).

type GlobalRule = { id: string; voice?: string | null; [k: string]: unknown };

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

  // Negative (a): remove the glob-out-of-scope owner -> the check MUST fail.
  it('FAILS when GLOBAL_RULES.glob-out-of-scope loses its voice owner', () => {
    const mutated = rulesById(baseRules);
    delete mutated['glob-out-of-scope'].voice; // simulate the removed owner
    const problems = validateGlobalVoiceOwnership({
      registry: GLOBAL_VOICE_OWNERSHIP,
      globalRulesById: mutated,
      toolFailure: TOOL_FAILURE,
    });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(/glob-out-of-scope.*carries NO voice field/i);
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

  // Exhaustiveness: a spoken global rule that is not registered MUST fail.
  it('FAILS when a spoken global rule is not declared in the registry', () => {
    const withUnregistered = rulesById(baseRules);
    withUnregistered['glob-invalid-value'] = {
      ...withUnregistered['glob-invalid-value'],
      voice: 'clip-family:onboard_invalid_value (pending recording)',
    };
    const problems = validateGlobalVoiceOwnership({
      registry: GLOBAL_VOICE_OWNERSHIP,
      globalRulesById: withUnregistered,
      toolFailure: TOOL_FAILURE,
    });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(
      /glob-invalid-value.*NOT declared in GLOBAL_VOICE_OWNERSHIP/i,
    );
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

describe('B1-R: prose lint — a GlobalRule.rule may not hide a spoken coach line', () => {
  it('the healthy production global rules carry no prose-hidden spoken line', () => {
    expect(findGlobalRuleProseSpokenLines(GLOBAL_RULES.rules)).toEqual([]);
  });

  it('FAILS on the exact Codex B1 probe (a spoken line after a speech verb)', () => {
    const withProbe = [
      {
        id: 'glob-unregistered-spoken-probe',
        rule: 'On an unrecognized global input, say "Let us get back to your onboarding" and then re-ask the current question.',
      },
      ...GLOBAL_RULES.rules,
    ];
    const problems = findGlobalRuleProseSpokenLines(withProbe);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(
      /glob-unregistered-spoken-probe.*prescribes a spoken coach line/i,
    );
  });

  it('does NOT fire on a quoted USER-input example (no speech verb before the quote)', () => {
    const userExample = [
      {
        id: 'glob-example',
        rule: 'Off-topic world questions ("who won the game yesterday"): steer back.',
      },
    ];
    expect(findGlobalRuleProseSpokenLines(userExample)).toEqual([]);
  });

  it('does NOT fire on a speech verb with no quoted line', () => {
    const noQuote = [
      { id: 'glob-machinery', rule: 'Never says beat, step, screen, page, card, tool, or system.' },
    ];
    expect(findGlobalRuleProseSpokenLines(noQuote)).toEqual([]);
  });
});
