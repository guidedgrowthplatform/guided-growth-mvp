import { describe, expect, it } from 'vitest';
import bundle from '@/generated/icon-bundle.json';
// @ts-expect-error — plain .mjs build helper, no types
import { collectUsedIcons } from '../../../scripts/icon-scan.mjs';

interface BundledCollection {
  prefix: string;
  icons: Record<string, unknown>;
  aliases?: Record<string, unknown>;
}

// prefix -> Set<name> present in the committed bundle (icons + aliases)
function bundledNames(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const c of bundle as unknown as BundledCollection[]) {
    map.set(c.prefix, new Set([...Object.keys(c.icons), ...Object.keys(c.aliases ?? {})]));
  }
  return map;
}

describe('icon bundle', () => {
  // Catches typos / missing-from-bundle for known-prefix icons. Does NOT catch
  // an icon whose prefix is absent from KNOWN_PREFIXES (invisible to the scan).
  it('contains every known-prefix icon referenced in src/', () => {
    const used = collectUsedIcons() as Map<string, Set<string>>;
    const present = bundledNames();
    const missing: string[] = [];
    for (const [prefix, names] of used) {
      const have = present.get(prefix);
      for (const name of names) {
        if (!have?.has(name)) missing.push(`${prefix}:${name}`);
      }
    }
    expect(missing, `regenerate with \`npm run icons:bundle\``).toEqual([]);
  });
});
