#!/usr/bin/env node
/**
 * Disables @capacitor-firebase/messaging on iOS by removing it from the
 * generated capacitor.config.json `packageClassList`.
 *
 * The plugin's load() calls +[FIRApp configure], which throws an uncaught
 * exception with no GoogleService-Info.plist bundled — crashing iOS on launch.
 * Capacitor instantiates plugins by iterating packageClassList, so dropping the
 * entry means load() never runs. FCM is dormant (Tier 1 uses @capacitor/local-
 * notifications); Android keeps Firebase via gradle.
 *
 * ios/ is gitignored + regenerated, so this re-runs after every `cap sync ios`.
 * Re-enable (Tier 2 push): wire a real GoogleService-Info.plist (see
 * patch-ios-push.mjs) and delete this script's calls + the iOS branch of
 * isPushSupported() in src/lib/push.ts.
 *
 * Usage: node scripts/patch-ios-disable-firebase.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CONFIG = resolve('ios/App/App/capacitor.config.json');

if (!existsSync(CONFIG)) {
  console.log('[patch-ios-disable-firebase] capacitor.config.json not found — skipping (run cap sync ios first)');
  process.exit(0);
}

const config = JSON.parse(readFileSync(CONFIG, 'utf-8'));
const before = Array.isArray(config.packageClassList) ? config.packageClassList : [];
const removed = before.filter((c) => /FirebaseMessaging/.test(c));

if (removed.length === 0) {
  console.log('[patch-ios-disable-firebase] firebase messaging not in packageClassList — nothing to do');
  process.exit(0);
}

config.packageClassList = before.filter((c) => !/FirebaseMessaging/.test(c));
if (config.plugins) delete config.plugins.FirebaseMessaging;

writeFileSync(CONFIG, JSON.stringify(config, null, '\t') + '\n', 'utf-8');
console.log(`[patch-ios-disable-firebase] ✚ Removed ${removed.join(', ')} from iOS plugin registration`);
