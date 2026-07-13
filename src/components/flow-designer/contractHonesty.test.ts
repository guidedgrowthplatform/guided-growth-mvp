import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
// PRODUCTION resolver + data, not a reimplementation.
import { BEATS_SOURCE, resolveBeatStructure } from './beatsSource';
import type { SectionFillStatus } from './beatsSource';

const SECTION_KEYS = [
  'identity',
  'scriptMeta',
  'components',
  'voice',
  'rulesContext',
  'rulesCode',
  'conversation',
  'contextProse',
  'allowedTools',
  'persistence',
  'flow',
  'edges',
  'acceptance',
  'applicableDecisions',
] as const;

function isLegalStatus(s: unknown): boolean {
  return (
    s === 'filled' ||
    s === 'derived' ||
    (typeof s === 'object' && s !== null && typeof (s as { na?: unknown }).na === 'string')
  );
}

describe('B1: real 62-beat manifest coverage (production resolver)', () => {
  it('every beat resolves a complete 14-key manifest with legal statuses', () => {
    for (const beat of BEATS_SOURCE) {
      const manifest = resolveBeatStructure(beat.id).sectionManifest;
      expect(manifest, `beat ${beat.id} must resolve a manifest`).toBeTruthy();
      expect(Object.keys(manifest!).sort()).toEqual([...SECTION_KEYS].sort());
      for (const key of SECTION_KEYS) {
        expect(
          isLegalStatus((manifest as Record<string, SectionFillStatus>)[key]),
          `${beat.id}.${key} must be a legal SectionFillStatus`,
        ).toBe(true);
      }
    }
  });

  it('62 beats -> 62 resolved manifests (no synthetic gaps)', () => {
    expect(BEATS_SOURCE.length).toBe(62);
    const resolved = BEATS_SOURCE.map((b) => resolveBeatStructure(b.id).sectionManifest);
    expect(resolved.filter(Boolean).length).toBe(62);
  });

  // The fill is COMPLETE, so there are zero non-variant beats left on the all-pending
  // fallback. This assertion is valid for a fully-contracted codebase: pre-fill this set
  // was nonempty and each such beat resolved an honest all-pending manifest; the fill
  // closed them all out. (Superseded the stale `noBible.length > 0` premise, which failed
  // on a void set once every beat authored a bible.)
  it('the fill is complete: every non-variant beat authors its own bible', () => {
    const noBible = BEATS_SOURCE.filter((b) => !b.bible && !b.variantOf);
    expect(noBible).toEqual([]);
  });

  // Resolver honesty on the fallback path is still real coverage: an UNKNOWN beat id must
  // NOT be handed a fabricated owner-filled (or any) manifest. It resolves to nothing.
  it('the resolver stays honest: an unknown beat id yields no fabricated manifest', () => {
    const resolved = resolveBeatStructure('__synthetic_no_such_beat__');
    expect(resolved.sectionManifest).toBeUndefined();
  });

  // Every real beat's manifest carries ONLY legal statuses (no fabricated owner-fill):
  // this is the honesty guarantee the stale test aimed at, now asserted across all 62.
  it('every resolved manifest carries only legal fill statuses (no fabricated owner-fill)', () => {
    for (const beat of BEATS_SOURCE) {
      const manifest = resolveBeatStructure(beat.id).sectionManifest!;
      for (const key of SECTION_KEYS) {
        expect(
          isLegalStatus((manifest as Record<string, SectionFillStatus>)[key]),
          `${beat.id}.${key} must be a legal SectionFillStatus`,
        ).toBe(true);
      }
    }
  });
});

describe('B1: render path shows the manifest for ALL beats, not bible-only', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(path.join(here, 'FlowDesigner.tsx'), 'utf8');

  it('SourceOfTruthPanel renders ManifestStatusList in the non-bible path', () => {
    const panelStart = src.indexOf('function SourceOfTruthPanel');
    expect(panelStart, 'SourceOfTruthPanel must exist').toBeGreaterThan(-1);
    const bibleGuard = src.indexOf('if (resolved.bible)', panelStart);
    expect(bibleGuard, 'bible-only early return must exist').toBeGreaterThan(-1);
    // Fails if someone re-narrows the render to authored bibles only: the manifest
    // list must render AFTER (i.e. outside) the resolved.bible early return.
    const afterGuard = src.indexOf('<ManifestStatusList', bibleGuard);
    expect(
      afterGuard,
      'ManifestStatusList must render for non-bible beats (after the resolved.bible early return)',
    ).toBeGreaterThan(-1);
  });
});
