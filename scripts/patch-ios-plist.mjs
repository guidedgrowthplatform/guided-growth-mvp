#!/usr/bin/env node
/**
 * Patches ios/App/App/Info.plist after `cap sync ios` to add required
 * privacy descriptions that Capacitor doesn't inject automatically.
 *
 * Since ios/ is gitignored, these entries are lost whenever the native
 * project is regenerated. This script ensures they're always present.
 *
 * Usage: node scripts/patch-ios-plist.mjs
 * Called automatically by `npm run cap:sync` and `npm run cap:sync:all`.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const PLIST_PATH = resolve('ios/App/App/Info.plist');

const PATCHES = [
  {
    key: 'NSMicrophoneUsageDescription',
    value: 'Guided Growth uses your microphone for voice commands to manage habits, log metrics, and record reflections hands-free.',
  },
];

if (!existsSync(PLIST_PATH)) {
  console.log('[patch-ios-plist] Info.plist not found — skipping (run cap sync ios first)');
  process.exit(0);
}

let plist = readFileSync(PLIST_PATH, 'utf-8');
let patched = false;

for (const { key, value } of PATCHES) {
  if (plist.includes(`<key>${key}</key>`)) {
    console.log(`[patch-ios-plist] ✓ ${key} already present`);
    continue;
  }

  // Insert before the closing </dict>
  const insertion = `\t<key>${key}</key>\n\t<string>${value}</string>\n`;
  plist = plist.replace('</dict>', `${insertion}</dict>`);
  patched = true;
  console.log(`[patch-ios-plist] ✚ Added ${key}`);
}

if (patched) {
  writeFileSync(PLIST_PATH, plist, 'utf-8');
  console.log('[patch-ios-plist] Info.plist patched successfully');
} else {
  console.log('[patch-ios-plist] No changes needed');
}
