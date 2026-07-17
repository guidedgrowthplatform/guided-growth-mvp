import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { OnboardingAudioManifest } from './lib/generateAudioManifest';

const root = resolve(import.meta.dirname, '../..');
const defaultManifest = resolve(root, 'src/generated/onboarding_audio_manifest.json');
const args = process.argv.slice(2);
const valueFor = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
const report = args.includes('--report');
const manifestPath = resolve(root, valueFor('--manifest') ?? defaultManifest);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as OnboardingAudioManifest;
const referenced = new Set<string>();

for (const beat of Object.values(manifest.beats)) {
  for (const line of beat.lines) {
    for (const asset of [line.renderWav, line.appMp3]) {
      if (asset !== undefined) referenced.add(asset.canonicalPath);
    }
  }
}

function scan(directory: string): string[] {
  const absoluteDirectory = resolve(root, directory);
  if (!existsSync(absoluteDirectory)) return [];
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(absoluteDirectory, entry.name);
    if (entry.isDirectory()) return scan(relative(root, path));
    return entry.isFile() ? [relative(root, path).replaceAll('\\', '/')] : [];
  });
}

const candidates = [...scan('public/voice/ob'), ...scan('public/voice/onboarding')].sort();
const orphans = candidates.filter((path) => !referenced.has(path));
console.log(`[audio-orphans] ${report ? 'REPORT' : 'REQUIRED'}: ${orphans.length} orphan(s)`);
for (const orphan of orphans) console.log(orphan);
if (!report && orphans.length > 0) process.exitCode = 1;
