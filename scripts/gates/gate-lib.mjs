import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const toPosix = (value) => value.split(path.sep).join('/');

export async function walkFiles(root, relativeRoots) {
  const results = [];
  for (const relativeRoot of relativeRoots) {
    const absoluteRoot = path.join(root, relativeRoot);
    let rootStats;
    try {
      rootStats = await stat(absoluteRoot);
    } catch (error) {
      if (error && error.code === 'ENOENT') continue;
      throw error;
    }
    if (!rootStats.isDirectory()) continue;
    await walkDirectory(root, absoluteRoot, results);
  }
  return results.sort((left, right) => left.localeCompare(right));
}

async function walkDirectory(root, directory, results) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      await walkDirectory(root, absolutePath, results);
    } else if (entry.isFile()) {
      results.push(toPosix(path.relative(root, absolutePath)));
    }
  }
}

export async function readUtf8(root, relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function parseCliArgs(argv, defaults) {
  const options = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--root') options.root = argv[++index];
    else if (argument === '--baseline') options.baseline = argv[++index];
    else if (argument === '--contract') options.contract = argv[++index];
    else if (argument === '--artifact') options.artifact = argv[++index];
    else if (argument === '--manifest') options.manifest = argv[++index];
    else if (argument === '--generate-baseline') options.generateBaseline = true;
    else if (argument === '--help') options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}
