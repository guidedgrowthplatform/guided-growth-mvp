import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { repositoryRoot, writerGate } from './config.mjs';
import { parseCliArgs, readUtf8, stableJson, walkFiles } from './gate-lib.mjs';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lineNumberAt = (source, index) => source.slice(0, index).split('\n').length;
const lineAt = (source, index) => source.split('\n')[lineNumberAt(source, index) - 1]?.trim() ?? '';

function patternsFor(table) {
  const escaped = escapeRegex(table);
  return [
    ['sql-insert', new RegExp(`\\bINSERT\\s+INTO\\s+['\"]?${escaped}['\"]?\\b`, 'gi')],
    ['sql-update', new RegExp(`\\bUPDATE\\s+['\"]?${escaped}['\"]?\\b`, 'gi')],
    ['sql-delete', new RegExp(`\\bDELETE\\s+FROM\\s+['\"]?${escaped}['\"]?\\b`, 'gi')],
    ['query-builder-from-write', new RegExp(`\\.from\\(\\s*['\"]${escaped}['\"]\\s*\\)[\\s\\S]{0,320}?\\.(?:insert|upsert|update|delete)\\b`, 'g')],
    ['query-builder-table-write', new RegExp(`\\.table\\(\\s*['\"]${escaped}['\"]\\s*\\)[\\s\\S]{0,320}?\\.(?:insert|upsert|update|delete)\\b`, 'g')],
  ];
}

function interpolatedTablePattern(table) {
  return new RegExp(`(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM|\\.from|\\.table)[^\\n;]{0,160}(?:\\$\\{[^}]*${escapeRegex(table)}[^}]*\\}|['\"][^'\"]*${escapeRegex(table)}[^'\"]*['\"])`, 'gi');
}

export function scanWriterSource(relativePath, source, tables = writerGate.tables) {
  const hits = [];
  for (const table of tables) {
    for (const [form, pattern] of patternsFor(table)) {
      for (const match of source.matchAll(pattern)) {
        hits.push({ table, form, path: relativePath, line: lineNumberAt(source, match.index), statement: lineAt(source, match.index) });
      }
    }
    for (const match of source.matchAll(interpolatedTablePattern(table))) {
      hits.push({ table, form: 'interpolated-table-heuristic', path: relativePath, line: lineNumberAt(source, match.index), statement: lineAt(source, match.index) });
    }
  }
  return hits.sort((left, right) => `${left.table}:${left.path}:${left.line}:${left.form}`.localeCompare(`${right.table}:${right.path}:${right.line}:${right.form}`));
}

export async function inventoryWriters(root, config = writerGate) {
  const files = await walkFiles(root, config.roots);
  const hits = [];
  for (const relativePath of files.filter((file) => !(config.ignoredPathPrefixes ?? []).some((prefix) => file.startsWith(prefix)))) hits.push(...scanWriterSource(relativePath, await readUtf8(root, relativePath), config.tables));
  return hits;
}

export function baselineFromHits(hits, config = writerGate) {
  const tables = Object.fromEntries(config.tables.map((table) => [table, { count: 0, statements: [] }]));
  for (const hit of hits) {
    tables[hit.table].count += 1;
    tables[hit.table].statements.push({ path: hit.path, line: hit.line, form: hit.form });
  }
  for (const entry of Object.values(tables)) entry.statements.sort((left, right) => `${left.path}:${left.line}:${left.form}`.localeCompare(`${right.path}:${right.line}:${right.form}`));
  return { version: 1, tables };
}

export function compareWriterBaseline(baseline, actual) {
  const problems = [];
  for (const [table, expected] of Object.entries(baseline.tables)) {
    const observed = actual.tables[table] ?? { count: 0, statements: [] };
    const expectedKeys = new Set(expected.statements.map((entry) => `${entry.path}:${entry.line}:${entry.form}`));
    const observedKeys = new Set(observed.statements.map((entry) => `${entry.path}:${entry.line}:${entry.form}`));
    if (observed.count > expected.count) problems.push({ category: 'writer-count-increase', table, expected: expected.count, observed: observed.count });
    for (const key of [...observedKeys].filter((entry) => !expectedKeys.has(entry)).sort()) problems.push({ category: 'uninventoried-writer', table, key });
  }
  return problems;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv, { root: repositoryRoot, baseline: writerGate.baselinePath });
  if (options.help) {
    console.log('Usage: node scripts/gates/check-writers.mjs [--root path] [--baseline path] [--generate-baseline]');
    return;
  }
  const root = path.resolve(options.root);
  const config = { ...writerGate, baselinePath: options.baseline };
  const actual = baselineFromHits(await inventoryWriters(root, config), config);
  const baselinePath = path.join(root, config.baselinePath);
  if (options.generateBaseline) {
    await writeFile(baselinePath, stableJson(actual));
    console.log(`Wrote writer baseline: ${config.baselinePath}`);
    return;
  }
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  const problems = compareWriterBaseline(baseline, actual);
  if (problems.length === 0) {
    console.log('Writer gate passed.');
    return;
  }
  for (const problem of problems) console.error(problem.category === 'uninventoried-writer' ? `${problem.category} ${problem.table} ${problem.key}` : `${problem.category} ${problem.table} expected=${problem.expected} observed=${problem.observed}`);
  throw new Error(`Writer gate found ${problems.length} baseline violation(s).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
