import { describe, it, expect } from 'vitest';
// PRODUCTION registry + sources.
import {
  validateGlobalVoiceOwnership,
  isLegalVoiceShape,
  // @ts-expect-error - plain .mjs check helper, no type declarations
} from '../../../scripts/checks/lib/globalVoiceOwnership.mjs';
import { GLOBAL_RULES, GLOBAL_VOICE_OWNERSHIP, TOOL_FAILURE } from './flowBible';
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
