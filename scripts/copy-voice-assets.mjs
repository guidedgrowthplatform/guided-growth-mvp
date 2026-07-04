#!/usr/bin/env node
// One-off: copy voice-assets Storage bucket PROD -> STAGING.
// READ-ONLY ON PROD — service key used for listing/download only, never writes.
//
//   node scripts/copy-voice-assets.mjs [--dry-run]
//
// Env (in .env.local or the shell):
//   PROD_SUPABASE_URL, PROD_SUPABASE_SERVICE_ROLE_KEY
//   STAGING_SUPABASE_URL, STAGING_SUPABASE_SERVICE_ROLE_KEY

import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const BUCKET = 'voice-assets';
const PROD_REF = 'pmunbflbjpoawicgimyc';
const DRY_RUN = process.argv.includes('--dry-run');

const required = [
  'PROD_SUPABASE_URL',
  'PROD_SUPABASE_SERVICE_ROLE_KEY',
  'STAGING_SUPABASE_URL',
  'STAGING_SUPABASE_SERVICE_ROLE_KEY',
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `Refusing to run: missing env var(s): ${missing.join(', ')}.\n` +
      'Set them in .env.local or the shell. Prod key is used read-only (list/download).'
  );
  process.exit(1);
}

// Misroute guard: writes target staging, reads target prod — assert both ends.
if (process.env.STAGING_SUPABASE_URL.includes(PROD_REF)) {
  console.error(`Refusing to run: STAGING_SUPABASE_URL contains prod ref ${PROD_REF}.`);
  process.exit(1);
}
if (!process.env.PROD_SUPABASE_URL.includes(PROD_REF)) {
  console.error(`Refusing to run: PROD_SUPABASE_URL does not contain prod ref ${PROD_REF}.`);
  process.exit(1);
}
if (process.env.STAGING_SUPABASE_URL === process.env.PROD_SUPABASE_URL) {
  console.error('Refusing to run: STAGING_SUPABASE_URL == PROD_SUPABASE_URL.');
  process.exit(1);
}

const prod = createClient(process.env.PROD_SUPABASE_URL, process.env.PROD_SUPABASE_SERVICE_ROLE_KEY);
const staging = createClient(
  process.env.STAGING_SUPABASE_URL,
  process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
);

const CONTENT_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.json': 'application/json',
  '.txt': 'text/plain',
};
const contentTypeFor = (path) =>
  CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';

// list() is one level + paged (max 100); recurse folders, page each level.
async function listAll(prefix = '') {
  const files = [];
  const PAGE = 100;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await prod.storage.from(BUCKET).list(prefix, {
      limit: PAGE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`list "${prefix}" failed: ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // folders have null id
      if (item.id === null) files.push(...(await listAll(path)));
      else files.push(path);
    }
    if (data.length < PAGE) break;
  }
  return files;
}

async function ensureStagingBucket() {
  // Match prod: voice-assets is public, 10 MB object limit.
  const { error } = await staging.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 10485760,
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`createBucket failed: ${error.message}`);
  }
  console.log(error ? `Staging bucket "${BUCKET}" exists.` : `Created staging bucket "${BUCKET}" (public).`);
}

async function copyOne(path) {
  const { data, error: dlErr } = await prod.storage.from(BUCKET).download(path);
  if (dlErr) throw new Error(`download failed: ${dlErr.message}`);
  const body = Buffer.from(await data.arrayBuffer());
  const { error: upErr } = await staging.storage.from(BUCKET).upload(path, body, {
    upsert: true,
    contentType: contentTypeFor(path),
  });
  if (upErr) throw new Error(`upload failed: ${upErr.message}`);
}

async function main() {
  console.log(`Listing prod bucket "${BUCKET}"…`);
  const files = await listAll();
  console.log(`Found ${files.length} object(s).`);

  if (DRY_RUN) {
    for (const f of files) console.log(`  [dry-run] would copy ${f} (${contentTypeFor(f)})`);
    console.log(`\nDry run: ${files.length} object(s) would be copied. No writes performed.`);
    return 0;
  }

  await ensureStagingBucket();

  let copied = 0;
  let failed = 0;
  for (const [i, path] of files.entries()) {
    try {
      await copyOne(path);
      copied++;
      console.log(`  [${i + 1}/${files.length}] copied ${path}`);
    } catch (err) {
      failed++;
      console.error(`  [${i + 1}/${files.length}] FAILED ${path}: ${err.message}`);
    }
  }

  console.log(`\nDone. copied=${copied} failed=${failed} total=${files.length}`);
  return failed > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
