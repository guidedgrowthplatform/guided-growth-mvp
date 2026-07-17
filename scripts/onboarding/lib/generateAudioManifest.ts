import { lstatSync } from 'node:fs';
import { normalize, relative, resolve } from 'node:path';
import type { ContractBeat, ReadContractResult } from './readContract';

export type AudioFormat = 'renderWav' | 'appMp3';
export interface ManifestAsset {
  canonicalPath: string;
  legacyPath?: string;
}
export interface ManifestLine {
  clipId: string;
  lockedText: string;
  voiceResolution: 'recorded' | 'live' | 'silent';
  renderWav?: ManifestAsset;
  appMp3?: ManifestAsset;
}
export interface ManifestBeat {
  /** Highest Phase A rename-tombstone sequence that resolves to this canonical beat. */
  contractSeq: number | null;
  opener?: ManifestLine;
  lines: ManifestLine[];
}
export interface OnboardingAudioManifest {
  beats: Record<string, ManifestBeat>;
}

const clipIdPattern = /^[a-z0-9][a-z0-9_-]*$/;
const windowsReserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const controlPattern = /[\u0000-\u001f\u007f]/;

function fail(path: string, message: string): never {
  throw new Error(`[audio-manifest] ${path}: ${message}`);
}
function stablePath(path: string, label: string): string {
  if (path !== path.normalize('NFC')) fail(label, 'must use NFC normalization');
  if (path.startsWith('/') || path.includes('\\') || controlPattern.test(path))
    fail(label, 'must be a safe relative path');
  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..'))
    fail(label, 'contains an unsafe path segment');
  if (normalize(path).replace(/\\/g, '/') !== path) fail(label, 'must be normalized');
  if (!path.startsWith('public/voice/ob/') && !path.startsWith('public/voice/onboarding/'))
    fail(label, 'must remain in an onboarding voice namespace');
  return path;
}

function assertContainedPath(root: string, relativePath: string, label: string): void {
  const absolutePath = resolve(root, relativePath);
  const relativePathFromRoot = relative(root, absolutePath);
  if (
    relativePathFromRoot === '' ||
    relativePathFromRoot === '..' ||
    relativePathFromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
  ) {
    fail(label, 'escapes the repository root');
  }
}

function assertNotSymlink(path: string, label: string): void {
  try {
    if (lstatSync(path).isSymbolicLink()) fail(label, 'must not be a symlink');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
function canonicalPath(clipId: string, format: AudioFormat): string {
  return format === 'renderWav'
    ? `public/voice/ob/${clipId}.wav`
    : `public/voice/onboarding/${clipId}.mp3`;
}
function assertClipId(clipId: string, path: string): void {
  if (clipId !== clipId.normalize('NFC')) fail(path, 'must use NFC normalization');
  if (!clipIdPattern.test(clipId)) fail(path, 'must match [a-z0-9][a-z0-9_-]*');
  if (windowsReserved.test(clipId)) fail(path, 'must not be a Windows reserved filename');
}
function legacyOpenerPath(
  beat: ContractBeat,
  legacyScreenIds: Map<string, string[]>,
): string | undefined {
  const legacyScreenId = legacyScreenIds.get(beat.id)?.[0];
  return legacyScreenId === undefined ? undefined : `public/voice/onboarding/${legacyScreenId}.mp3`;
}
function formatsFor(
  resolution: ManifestLine['voiceResolution'],
  isOpener: boolean,
  engine: ContractBeat['voice']['engine'],
): AudioFormat[] {
  if (resolution !== 'recorded') return [];
  return isOpener && engine === 'MP3' ? ['renderWav', 'appMp3'] : ['renderWav'];
}
function assetFor(format: AudioFormat, clipId: string, legacyPath?: string): ManifestAsset {
  return legacyPath === undefined
    ? { canonicalPath: canonicalPath(clipId, format) }
    : { canonicalPath: canonicalPath(clipId, format), legacyPath };
}
function addLine(
  output: ManifestLine,
  format: AudioFormat,
  clipId: string,
  legacyPath: string | undefined,
): void {
  if (format === 'renderWav') output.renderWav = assetFor(format, clipId, legacyPath);
  else output.appMp3 = assetFor(format, clipId, legacyPath);
}

export function renderAudioManifest({ contract, contractSha256 }: ReadContractResult): {
  manifest: OnboardingAudioManifest;
  metadata: { contractRevision: string; contractSha256: string };
} {
  const legacyScreenIds = new Map<string, string[]>();
  for (const entry of contract.legacyCrosswalk.entries) {
    const values = legacyScreenIds.get(entry.beatId) ?? [];
    values.push(entry.legacyScreenId);
    legacyScreenIds.set(entry.beatId, values);
  }
  const canonicalAssets = new Map<string, string>();
  const sharedClips = new Map<string, string>();
  const contractSeqByCanonicalBeat = new Map<string, number>();
  for (const rename of Object.values(contract.renames)) {
    const current = contractSeqByCanonicalBeat.get(rename.beatId);
    if (current === undefined || rename.contractSeq > current)
      contractSeqByCanonicalBeat.set(rename.beatId, rename.contractSeq);
  }
  const beats: OnboardingAudioManifest['beats'] = {};
  for (const beat of [...contract.beats].sort((left, right) => left.order - right.order)) {
    const resolutions = new Map(beat.voice.perLine.map((line) => [line.seq, line.resolution]));
    const manifestBeat: Omit<ManifestBeat, 'contractSeq'> = { lines: [] };
    for (const line of beat.script) {
      const voiceResolution = resolutions.get(line.seq);
      if (voiceResolution === undefined)
        fail(`beats.${beat.id}.script.${line.seq}`, 'has no voice resolution');
      if (voiceResolution !== 'recorded') continue;
      if (line.clip === null || line.clipPath === null || !line.words)
        fail(
          `beats.${beat.id}.script.${line.seq}`,
          'recorded audio requires clipId, clipPath, and locked text',
        );
      assertClipId(line.clip, `beats.${beat.id}.script.${line.seq}.clip`);
      const legacyWavPath = stablePath(
        line.clipPath,
        `beats.${beat.id}.script.${line.seq}.clipPath`,
      );
      const isOpener = line.seq === beat.openerSeq;
      const entry: ManifestLine = { clipId: line.clip, lockedText: line.words, voiceResolution };
      for (const format of formatsFor(voiceResolution, isOpener, beat.voice.engine)) {
        const legacyPath =
          format === 'renderWav' ? legacyWavPath : legacyOpenerPath(beat, legacyScreenIds);
        if (legacyPath !== undefined)
          stablePath(legacyPath, `beats.${beat.id}.script.${line.seq}.${format}.legacyPath`);
        addLine(entry, format, line.clip, legacyPath);
        const path = canonicalPath(line.clip, format);
        const collisionKey = path.normalize('NFC').toLowerCase();
        const existingPath = canonicalAssets.get(collisionKey);
        if (existingPath !== undefined && existingPath !== path) {
          fail(`clipId.${line.clip}`, `canonical ${format} path collides after case folding`);
        }
        canonicalAssets.set(collisionKey, path);
      }
      const previous = sharedClips.get(line.clip);
      const comparison = JSON.stringify({
        lockedText: entry.lockedText,
        voiceResolution: entry.voiceResolution,
        renderWav: Boolean(entry.renderWav),
        appMp3: Boolean(entry.appMp3),
      });
      if (previous !== undefined && previous !== comparison)
        fail(`clipId.${line.clip}`, 'is shared with incompatible text, resolution, or formats');
      sharedClips.set(line.clip, comparison);
      manifestBeat.lines.push(entry);
      if (isOpener && manifestBeat.opener === undefined) manifestBeat.opener = entry;
    }
    if (manifestBeat.lines.length > 0) {
      const canonicalBeatId = beat.parent ?? beat.id;
      const canonicalBeat = beats[canonicalBeatId] ?? {
        contractSeq: contractSeqByCanonicalBeat.get(canonicalBeatId) ?? null,
        lines: [],
      };
      canonicalBeat.lines.push(...manifestBeat.lines);
      if (canonicalBeat.opener === undefined && manifestBeat.opener !== undefined)
        canonicalBeat.opener = manifestBeat.opener;
      beats[canonicalBeatId] = canonicalBeat;
    }
  }
  return {
    manifest: { beats },
    metadata: { contractRevision: contract.contractRevision, contractSha256 },
  };
}

export function verifyAudioManifestAssets(root: string, manifest: OnboardingAudioManifest): void {
  for (const [beatId, beat] of Object.entries(manifest.beats)) {
    for (const [lineIndex, line] of beat.lines.entries()) {
      for (const [format, asset] of [
        ['renderWav', line.renderWav],
        ['appMp3', line.appMp3],
      ] as const) {
        if (asset === undefined) continue;
        assertContainedPath(
          root,
          asset.canonicalPath,
          `beats.${beatId}.lines[${lineIndex}].${format}`,
        );
        const assetPath = resolve(root, asset.canonicalPath);
        assertNotSymlink(assetPath, `beats.${beatId}.lines[${lineIndex}].${format}`);
        assertNotSymlink(
          resolve(assetPath, '..'),
          `beats.${beatId}.lines[${lineIndex}].${format}.parent`,
        );
        try {
          if (!lstatSync(assetPath).isFile())
            fail(`beats.${beatId}.lines[${lineIndex}].${format}`, 'must be a regular file');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            fail(`beats.${beatId}.lines[${lineIndex}].${format}`, 'canonical asset is missing');
          throw error;
        }
      }
    }
  }
}
