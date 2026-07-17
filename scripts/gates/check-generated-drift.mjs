import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { driftGate, repositoryRoot } from './config.mjs';
import { parseCliArgs } from './gate-lib.mjs';

async function exists(filePath) { try { await access(filePath); return true; } catch { return false; } }

function run(command, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (status) => resolve({ status: status ?? 1, output: output.trim() }));
    child.on('error', (error) => resolve({ status: 1, output: error.message }));
  });
}

export async function reportGeneratedDrift(root, config = driftGate) {
  const regeneration = await run(['node', 'scripts/onboarding/regenerate-all.mjs'], root);
  const missing = [];
  for (const artifact of config.generatedArtifacts) if (!(await exists(path.join(root, artifact)))) missing.push(artifact);
  return {
    missing,
    changed: [],
    regeneration,
    note: 'report mode never fails: aggregate generation and temporary-copy byte diff activate when onboarding:generate is registered.',
  };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv, { root: repositoryRoot });
  const report = await reportGeneratedDrift(path.resolve(options.root));
  if (report.regeneration.status !== 0) console.log(`DRIFT regenerate-unavailable ${report.regeneration.output || 'unknown'}`);
  for (const artifact of report.missing) console.log(`DRIFT missing ${artifact}`);
  for (const artifact of report.changed) console.log(`DRIFT changed ${artifact}`);
  if (report.regeneration.status === 0 && report.missing.length === 0 && report.changed.length === 0) console.log('DRIFT clean (report mode).');
  console.log(`NOTE ${report.note}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
