// Shared by build-icon-bundle.mjs (generator) and iconBundle.test.ts (guard)
// so the scan rules can't drift between them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

export const ICON_RE = /['"]([a-z0-9]+(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)['"]/g;

// Iconify collections the app uses. Explicit allowlist (not auto-detected) so
// stray "word:word" literals — URLs, times, CSS — never get treated as icons.
// Add a prefix here when introducing icons from a new collection.
export const KNOWN_PREFIXES = new Set([
  'mdi',
  'ic',
  'material-symbols',
  'mingcute',
  'svg-spinners',
  'lucide',
  'iconamoon',
  'si',
  'octicon',
  'lets-icons',
  'ix',
  'icon-park-outline',
  'hugeicons',
  'boxicons',
  'fa6-solid',
]);

export function walkSourceFiles(dir = SRC, files = []) {
  for (const entry of readdirSync(dir)) {
    // Skip the flow-builder dev tool (its own deps + build) and Storybook
    // stories, the same scoping as tsconfig: their icons are not in the shipped app.
    if (entry === 'generated' || entry === 'node_modules' || entry === 'flow-designer') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkSourceFiles(full, files);
    else if (/\.(tsx?|jsx?)$/.test(entry) && !/\.stories\./.test(entry)) files.push(full);
  }
  return files;
}

// prefix -> Set<name>, restricted to KNOWN_PREFIXES
export function collectUsedIcons() {
  const used = new Map();
  for (const file of walkSourceFiles()) {
    for (const [, prefix, name] of readFileSync(file, 'utf8').matchAll(ICON_RE)) {
      if (!KNOWN_PREFIXES.has(prefix)) continue;
      if (!used.has(prefix)) used.set(prefix, new Set());
      used.get(prefix).add(name);
    }
  }
  return used;
}
