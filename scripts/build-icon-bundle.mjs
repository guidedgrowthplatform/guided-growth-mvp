// Scans src/ for Iconify "prefix:name" strings and emits an offline icon
// bundle (src/generated/icon-bundle.json). Lets <Icon> resolve from memory
// instead of fetching api.iconify.design at runtime — works offline + native.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { lookupCollection } from '@iconify/json';
import { getIcons } from '@iconify/utils';
import { SRC, collectUsedIcons } from './icon-scan.mjs';

const OUT = join(SRC, 'generated', 'icon-bundle.json');

const used = collectUsedIcons();

const collections = [];
const missing = [];
let total = 0;
for (const prefix of [...used.keys()].sort()) {
  const names = [...used.get(prefix)].sort();
  const full = await lookupCollection(prefix);
  const subset = getIcons(full, names, true);
  if (!subset) throw new Error(`No icons resolved for "${prefix}"`);
  if (subset.not_found?.length) {
    for (const name of subset.not_found) missing.push(`${prefix}:${name}`);
    delete subset.not_found;
  }
  delete subset.lastModified;
  collections.push(subset);
  total += Object.keys(subset.icons).length + Object.keys(subset.aliases ?? {}).length;
}

// CSP omits the Iconify CDN — an unresolved icon renders nothing at runtime.
if (missing.length) {
  throw new Error(`[icon-bundle] unresolved icons: ${missing.join(', ')}`);
}

writeFileSync(OUT, JSON.stringify(collections, null, 2) + '\n');
console.log(
  `[icon-bundle] wrote ${total} icons across ${collections.length} collections -> ${OUT}`,
);
