#!/usr/bin/env node
/**
 * Patches android/app/src/main/AndroidManifest.xml after `cap sync android`
 * to add exact-alarm permissions needed for minute-exact local reminders.
 *
 * android/ is gitignored/regenerated, so these are re-injected each sync.
 * USE_EXACT_ALARM is Google-Play-policy gated to alarm/reminder apps.
 *
 * Usage: node scripts/patch-android-manifest.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const MANIFEST_PATH = resolve('android/app/src/main/AndroidManifest.xml');

const PERMISSIONS = [
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_EXACT_ALARM',
];

if (!existsSync(MANIFEST_PATH)) {
  console.warn(`[patch-android-manifest] ${MANIFEST_PATH} not found — run cap sync android first; skipping`);
  process.exit(0);
}

let xml = readFileSync(MANIFEST_PATH, 'utf8');

const missing = PERMISSIONS.filter((p) => !xml.includes(p));
if (missing.length === 0) {
  console.log('[patch-android-manifest] exact-alarm permissions already present');
  process.exit(0);
}

// uses-permission must be a direct <manifest> child, before <application>
const openTag = /<manifest\b[^>]*>/.exec(xml);
if (!openTag) {
  console.error('[patch-android-manifest] no <manifest> tag found');
  process.exit(1);
}

const insertion = missing.map((p) => `\n    <uses-permission android:name="${p}" />`).join('');
const at = openTag.index + openTag[0].length;
xml = xml.slice(0, at) + insertion + xml.slice(at);
writeFileSync(MANIFEST_PATH, xml);
console.log(`[patch-android-manifest] added: ${missing.join(', ')}`);
