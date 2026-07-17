import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { onboardingIdGate, repositoryRoot } from './config.mjs';
import { parseCliArgs, readUtf8, walkFiles } from './gate-lib.mjs';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tokenPattern = (id) => new RegExp(`(['\"\x60])${escapeRegex(id)}\\1`, 'g');

export async function loadOnboardingIds(root, contractPath = onboardingIdGate.contractPath) {
  const contract = JSON.parse(await readFile(path.join(root, contractPath), 'utf8'));
  const canonical = contract.beats.map(({ id }) => id);
  const legacy = contract.legacyCrosswalk.entries.map(({ legacyScreenId }) => legacyScreenId);
  return { canonical: [...new Set(canonical)], legacy: [...new Set(legacy)] };
}

export function isAllowedIdPath(relativePath, config = onboardingIdGate) {
  if (relativePath === config.generatedCrosswalkPath) return true;
  if (config.exactAllowlist.includes(relativePath)) return true;
  return config.prefixAllowlist.some((prefix) => relativePath.startsWith(prefix));
}

export async function findIdLiteralViolations(root, config = onboardingIdGate) {
  const ids = await loadOnboardingIds(root, config.contractPath);
  const files = await walkFiles(root, config.runtimeRoots);
  const violations = [];
  for (const relativePath of files) {
    if (isAllowedIdPath(relativePath, config)) continue;
    const source = await readUtf8(root, relativePath);
    for (const kind of ['canonical', 'legacy']) {
      for (const id of ids[kind]) {
        for (const match of source.matchAll(tokenPattern(id))) {
          const before = source.slice(0, match.index);
          violations.push({
            category: kind === 'canonical' ? 'canonical-id-literal' : 'legacy-id-literal',
            path: relativePath,
            line: before.split('\n').length,
            id,
          });
        }
      }
    }
  }
  return violations.sort((left, right) => `${left.path}:${left.line}:${left.id}`.localeCompare(`${right.path}:${right.line}:${right.id}`));
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv, { root: repositoryRoot, contract: onboardingIdGate.contractPath });
  if (options.help) {
    console.log('Usage: node scripts/gates/check-id-literals.mjs [--root path] [--contract path]');
    return;
  }
  const config = { ...onboardingIdGate, contractPath: options.contract };
  const violations = await findIdLiteralViolations(path.resolve(options.root), config);
  if (violations.length === 0) {
    console.log('ID literal gate passed.');
    return;
  }
  for (const violation of violations) console.error(`${violation.category} ${violation.path}:${violation.line}`);
  throw new Error(`ID literal gate found ${violations.length} hardcoded onboarding ID literal(s).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
