import { describe, it, expect } from 'vitest';
// PRODUCTION resolver + data + builders, not a reimplementation.
import {
  BEAT_BY_ID,
  resolveBeatStructure,
  goalsCategoryData,
  goalsSemanticTokens,
  buildGoalsRulesContext,
  buildGoalsConversation,
  buildGoalsFlow,
  buildGoalsEdges,
} from './beatsSource';

// The 7 non-Sleep goals variants (goals-sleep is the head).
const VARIANT_IDS = [
  'goals-move',
  'goals-eat',
  'goals-energy',
  'goals-stress',
  'goals-focus',
  'goals-break',
  'goals-organize',
] as const;

const HEAD_ID = 'goals-sleep';
const HEAD_CATEGORY = 'Sleep better';

// Case-normalized scan for a head-category token anywhere in a JSON-serialized value.
function containsToken(value: unknown, token: string): boolean {
  return JSON.stringify(value ?? null)
    .toLowerCase()
    .includes(token.toLowerCase());
}

describe('B1-R: head <-> builder parity (single source of truth)', () => {
  // The head goals-sleep authors these sections inline; the builders must
  // reproduce them byte-for-byte from goalsCategoryData['Sleep better']. If the
  // head drifts from the builder (or vice versa) this fails, so the derived
  // variants and the authored head can never diverge in structure/wording.
  const head = BEAT_BY_ID[HEAD_ID];
  const data = goalsCategoryData[HEAD_CATEGORY];

  it('goalsCategoryData has an entry for the head category', () => {
    expect(data).toBeTruthy();
    expect(head?.bible).toBeTruthy();
  });

  it('buildGoalsRulesContext reproduces the head rulesContext', () => {
    expect(buildGoalsRulesContext(data)).toEqual(head.bible!.rulesContext);
  });
  it('buildGoalsConversation reproduces the head conversation', () => {
    expect(buildGoalsConversation(data)).toEqual(head.bible!.conversation);
  });
  it('buildGoalsFlow reproduces the head flow', () => {
    expect(buildGoalsFlow(data)).toEqual(head.bible!.flow);
  });
  it('buildGoalsEdges reproduces the head edges', () => {
    expect(buildGoalsEdges(data)).toEqual(head.bible!.edges);
  });
});

describe('B1-R: no head-category token survives onto ANY variant', () => {
  // The resolver-level semantic token set for the head category (case-normalized
  // category noun, clip-family root, beatId, category example label) PLUS the
  // exact head tokens (category label, head clip ids, head screenId).
  const head = BEAT_BY_ID[HEAD_ID];
  const semanticTokens = goalsSemanticTokens(HEAD_CATEGORY);
  const exactTokens = [
    HEAD_CATEGORY, // 'Sleep better'
    head.screenId ?? '', // 'ONBOARD-BEGINNER-02--SLEEP'
    ...head.script.map((l) => l.clip ?? ''), // opener clip id
  ].filter(Boolean);
  const allHeadTokens = [...new Set([...semanticTokens, ...exactTokens])];

  it('semantic token set is non-trivial (guards against an empty scan)', () => {
    expect(semanticTokens).toContain('sleep');
    expect(semanticTokens).toContain('onboard_goals_sleep');
    expect(semanticTokens).toContain('goals-sleep');
    expect(semanticTokens.some((t) => /fall asleep earlier/i.test(t))).toBe(true);
  });

  for (const id of VARIANT_IDS) {
    it(`${id} resolves ZERO head tokens across EVERY derived section`, () => {
      const resolved = resolveBeatStructure(id);
      expect(resolved.bible, `${id} must resolve a bible`).toBeTruthy();
      const derived = resolved.derivedSections ?? [];
      const leaks: string[] = [];
      // Scan EVERY derived section (not just the 4 rebuilt ones), so a regression
      // in any inherited/substituted section is also caught.
      for (const key of derived) {
        const section = (resolved.bible as unknown as Record<string, unknown>)[key];
        for (const token of allHeadTokens) {
          if (containsToken(section, token)) leaks.push(`${key} leaks "${token}"`);
        }
      }
      expect(leaks, `${id} leaked head tokens: ${leaks.join(', ')}`).toEqual([]);
    });
  }

  it('goals-move still resolves its OWN Move opener, clip family, tiles, and downstream route', () => {
    const bible = JSON.stringify(resolveBeatStructure('goals-move').bible);
    expect(bible).toContain('onboard_beginner_02_move'); // Move opener clip
    expect(bible).toContain('onboard_goals_move'); // Move clip family root
    expect(bible).toContain('Walk more'); // Move tile
    expect(bible).toContain('habits-walk-more'); // Move downstream route
    expect(bible).toContain('gmove-'); // Move rule-id prefix
  });
});

describe('B1-R: the scan BITES on any leaked head token (mutation proof)', () => {
  const allTokens = [
    ...goalsSemanticTokens(HEAD_CATEGORY),
    HEAD_CATEGORY,
    BEAT_BY_ID[HEAD_ID].screenId ?? '',
  ].filter(Boolean);

  it('detects a deliberately poisoned section carrying a head token', () => {
    // Simulate a resolver regression: a variant section that still carries the
    // head's lowercased noun / clip family / example. Every such poison must trip
    // the case-normalized scan (not only an exact deleted-substitution shape).
    const poisons = [
      { rulesContext: [{ rule: 'Speaks the recorded sleep opener verbatim' }] },
      { conversation: { branches: [{ voice: 'clip-family:onboard_goals_sleep_2 (pending)' }] } },
      { flow: { rows: [{ value: 'Fall asleep earlier -> habits-fall-asleep-earlier' }] } },
      { edges: { rows: [{ edge: 'vague ("just sleep in general")' }] } },
      { flow: { rows: [{ value: 'routes to this goals-sleep variant' }] } },
    ];
    for (const poison of poisons) {
      const hit = allTokens.some((t) => containsToken(poison, t));
      expect(hit, `poison ${JSON.stringify(poison)} must be detected`).toBe(true);
    }
  });

  it('a clean per-variant section is NOT falsely flagged', () => {
    const clean = resolveBeatStructure('goals-break').bible;
    const hit = goalsSemanticTokens(HEAD_CATEGORY).some((t) => containsToken(clean, t));
    expect(hit).toBe(false);
  });
});
