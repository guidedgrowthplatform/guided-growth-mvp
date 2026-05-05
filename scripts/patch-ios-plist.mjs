#!/usr/bin/env node
/**
 * Patches files Capacitor regenerates on every `cap sync ios`:
 *   1. ios/App/App/Info.plist — add privacy description keys Capacitor
 *      doesn't inject automatically.
 *   2. ios/App/CapApp-SPM/Package.swift — pin capacitor-swift-pm to a
 *      version where the @capacitor/{preferences,app,browser} plugin
 *      Swift sources still compile. CLI 8.1.x defaults the pin to
 *      `exact: "8.1.0"`, but capacitor-swift-pm 8.1.0 changed
 *      CAPPluginCall.getString to require a default-value second arg
 *      and removed `reject` — breaking the latest-stable plugins
 *      (preferences@8.0.1, app@8.1.0, browser@8.0.3) that still call
 *      the pre-8.1 API. Pin to 8.0.2 (last 8.0.x) until those plugins
 *      are republished. Drop this rewrite once that happens.
 *
 * Since ios/ is gitignored, both edits are lost whenever the native
 * project is regenerated. This script keeps them deterministic.
 *
 * Usage: node scripts/patch-ios-plist.mjs
 * Called automatically by `npm run cap:sync` and `npm run cap:sync:all`.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const PLIST_PATH = resolve('ios/App/App/Info.plist');
const SPM_PACKAGE_PATH = resolve('ios/App/CapApp-SPM/Package.swift');
const CAPACITOR_SWIFT_PM_PIN = '8.0.2';

const PATCHES = [
  {
    key: 'NSMicrophoneUsageDescription',
    value:
      'Guided Growth uses your microphone for voice commands to manage habits, log metrics, and record reflections hands-free.',
  },
];

// ── Info.plist ──────────────────────────────────────────────────────────────
if (!existsSync(PLIST_PATH)) {
  console.log('[patch-ios-plist] Info.plist not found — skipping (run cap sync ios first)');
} else {
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
    console.log('[patch-ios-plist] No Info.plist changes needed');
  }
}

// ── CapApp-SPM/Package.swift ────────────────────────────────────────────────
if (!existsSync(SPM_PACKAGE_PATH)) {
  console.log('[patch-ios-plist] CapApp-SPM Package.swift not found — skipping');
} else {
  const original = readFileSync(SPM_PACKAGE_PATH, 'utf-8');
  const pinRegex = /(capacitor-swift-pm\.git", exact: ")[^"]+(")/;
  const match = original.match(pinRegex);

  if (!match) {
    console.log('[patch-ios-plist] could not locate capacitor-swift-pm pin — skipping SPM patch');
  } else if (match[0].includes(`exact: "${CAPACITOR_SWIFT_PM_PIN}"`)) {
    console.log(`[patch-ios-plist] ✓ capacitor-swift-pm already pinned to ${CAPACITOR_SWIFT_PM_PIN}`);
  } else {
    const updated = original.replace(pinRegex, `$1${CAPACITOR_SWIFT_PM_PIN}$2`);
    writeFileSync(SPM_PACKAGE_PATH, updated, 'utf-8');
    console.log(`[patch-ios-plist] ✚ Pinned capacitor-swift-pm to ${CAPACITOR_SWIFT_PM_PIN}`);
  }
}
