import type { OnboardingContractV1 } from './readContract';

export interface BeatIdMapData {
  beatIds: string[];
  legacyScreenIdToBeatId: Record<string, string>;
  beatIdToLegacyScreenIds: Record<string, string[]>;
  vapiBeatIds: string[];
  mp3BeatIds: string[];
  hybridBeatIds: string[];
}

export function beatIdMapData(contract: OnboardingContractV1): BeatIdMapData {
  const beatIds = contract.beats.map((beat) => beat.id);
  const legacyScreenIdToBeatId: Record<string, string> = {};
  const beatIdToLegacyScreenIds: Record<string, string[]> = Object.fromEntries(beatIds.map((id) => [id, []]));
  for (const entry of contract.legacyCrosswalk.entries) {
    // A variant family may intentionally share one legacy screen ID. Retain
    // the contract's first (base/default) mapping for single-value consumers;
    // the reverse map remains complete for variant-aware migrations.
    legacyScreenIdToBeatId[entry.legacyScreenId] ??= entry.beatId;
    beatIdToLegacyScreenIds[entry.beatId].push(entry.legacyScreenId);
  }
  const vapiBeatIds = contract.beats.filter((beat) => beat.voice.engine === 'Vapi').map((beat) => beat.id);
  const mp3BeatIds = contract.beats.filter((beat) => beat.voice.engine === 'MP3').map((beat) => beat.id);
  const hybridBeatIds = contract.beats
    .filter((beat) => {
      const resolutions = new Set(beat.voice.perLine.map((line) => line.resolution));
      return resolutions.has('recorded') && resolutions.has('live');
    })
    .map((beat) => beat.id);
  return { beatIds, legacyScreenIdToBeatId, beatIdToLegacyScreenIds, vapiBeatIds, mp3BeatIds, hybridBeatIds };
}

export function renderBeatIdsModule(contract: OnboardingContractV1): string {
  const data = beatIdMapData(contract);
  const json = (value: unknown) => JSON.stringify(value, null, 2);
  return [
    '// GENERATED from the onboarding contract. DO NOT EDIT.',
    `// contractRevision: ${contract.contractRevision}`,
    '',
    `export const BEAT_IDS = ${json(data.beatIds)} as const;`,
    'export type BeatId = (typeof BEAT_IDS)[number];',
    '',
    `export const LEGACY_SCREEN_ID_TO_BEAT_ID: Readonly<Record<string, BeatId>> = ${json(data.legacyScreenIdToBeatId)};`,
    `export const BEAT_ID_TO_LEGACY_SCREEN_IDS: Readonly<Record<BeatId, readonly string[]>> = ${json(data.beatIdToLegacyScreenIds)};`,
    '',
    `export const VAPI_BEAT_IDS: ReadonlySet<BeatId> = new Set(${json(data.vapiBeatIds)});`,
    `export const MP3_BEAT_IDS: ReadonlySet<BeatId> = new Set(${json(data.mp3BeatIds)});`,
    `export const HYBRID_BEAT_IDS: ReadonlySet<BeatId> = new Set(${json(data.hybridBeatIds)});`,
    '',
    'export function beatIdForLegacyScreenId(screenId: string): BeatId | undefined {',
    '  return LEGACY_SCREEN_ID_TO_BEAT_ID[screenId];',
    '}',
    '',
  ].join('\n');
}
