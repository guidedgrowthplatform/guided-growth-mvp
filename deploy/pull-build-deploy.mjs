#!/usr/bin/env node
/**
 * Pull the production env from Vercel, rebuild the engine image with the real
 * prod VITE_* values baked in (so the Azure engine is a faithful QA replica of
 * prod), and deploy it with the full server-side secret set.
 *
 * Token: keychain service `vercel-guided-growth`. No secrets are written to
 * disk or printed; values pass to `az`/`az acr build` as argv (spawn array).
 *
 * Usage: node deploy/pull-build-deploy.mjs [--no-build]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';

const TEAM = 'team_3MU2ra11JF8dS5seiSygFwYr';
const PROJ = 'prj_Cl6B1Jq4lTimyqIFpjjULDPVtfnN';
const RG = 'gg-engine';
const APP = 'gg-engine';
const ACR = (() => {
  try {
    return fs.readFileSync('/tmp/gg-acr-name.txt', 'utf8').trim();
  } catch {
    return 'ggengineacr66665';
  }
})();
const FQDN = 'gg-engine.kindwave-3cbdee63.eastus2.azurecontainerapps.io';
const IMAGE = `${ACR}.azurecr.io/gg-engine:full`;
const noBuild = process.argv.includes('--no-build');

// VITE_API_URL is deliberately NOT baked so the served SPA calls same-origin.
const SKIP_BUILD_ARGS = new Set(['VITE_API_URL']);
// Multiline / not-needed-for-QA server secrets to skip (push notifications).
const SKIP_SECRETS = new Set(['FIREBASE_SERVICE_ACCOUNT']);

const token = execFileSync('security', ['find-generic-password', '-s', 'vercel-guided-growth', '-w'])
  .toString()
  .trim();

const res = await fetch(
  `https://api.vercel.com/v9/projects/${PROJ}/env?teamId=${TEAM}&decrypt=true`,
  { headers: { Authorization: `Bearer ${token}` } },
);
const json = await res.json();
if (json.error) throw new Error('Vercel API: ' + JSON.stringify(json.error));
const prod = (json.envs || []).filter((e) => (e.target || []).includes('production'));

const viteArgs = []; // for az acr build --build-arg
const secrets = []; // {name, value} for az containerapp
for (const e of prod) {
  if (typeof e.value !== 'string' || e.value.length === 0) continue;
  if (e.key.startsWith('VITE_')) {
    if (!SKIP_BUILD_ARGS.has(e.key)) viteArgs.push('--build-arg', `${e.key}=${e.value}`);
  } else {
    if (SKIP_SECRETS.has(e.key)) continue;
    if (e.value.includes('\n')) {
      console.log(`  (skipping multiline secret ${e.key})`);
      continue;
    }
    secrets.push({ name: e.key.toLowerCase().replace(/_/g, '-'), value: e.value, key: e.key });
  }
}
console.log(`prod env: ${viteArgs.length / 2} VITE build args, ${secrets.length} server secrets`);

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} exited ${r.status}`);
}

if (!noBuild) {
  console.log('== rebuilding gg-engine:full with prod VITE values ==');
  run('az', [
    'acr', 'build', '--registry', ACR, '--image', 'gg-engine:full', '-f', 'Dockerfile',
    '--build-arg', 'SKIP_SPA=0',
    '--build-arg', `VITE_PUBLIC_WEB_ORIGIN=https://${FQDN}`,
    ...viteArgs,
    '.',
  ]);
}

console.log('== setting server secrets ==');
run('az', [
  'containerapp', 'secret', 'set', '-n', APP, '-g', RG, '-o', 'none',
  '--secrets', ...secrets.map((s) => `${s.name}=${s.value}`),
]);

console.log('== updating container app env + image ==');
run('az', [
  'containerapp', 'update', '-n', APP, '-g', RG, '-o', 'none',
  '--image', IMAGE,
  '--set-env-vars',
  ...secrets.map((s) => `${s.key}=secretref:${s.name}`),
  'NODE_ENV=production', 'PORT=8080',
]);

console.log(`\nDONE -> https://${FQDN}`);
