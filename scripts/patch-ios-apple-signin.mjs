#!/usr/bin/env node
/**
 * Patches the regenerated ios/ project for Sign in with Apple after
 * `cap sync ios` (same model as patch-ios-plist.mjs — ios/ is gitignored,
 * so the entitlement must be re-applied on each build):
 *
 *   1. App.entitlements with com.apple.developer.applesignin (created or merged).
 *   2. CODE_SIGN_ENTITLEMENTS in pbxproj (skipped if already set).
 *
 * ORDERING: must run AFTER patch-ios-push.mjs — that script writes
 * App.entitlements only-if-absent (no merge); if this one ran first, push's
 * aps-environment key would be silently skipped when Firebase is re-enabled.
 *
 * Usage: node scripts/patch-ios-apple-signin.mjs
 * Called by `npm run cap:sync` / `cap:sync:all` and the iOS CI jobs.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const PBXPROJ = resolve('ios/App/App.xcodeproj/project.pbxproj');
const ENTITLEMENTS = resolve('ios/App/App/App.entitlements');

if (!existsSync(PBXPROJ)) {
  console.log('[patch-ios-apple-signin] ios project not found — skipping (run cap sync ios first)');
  process.exit(0);
}

const SIGNIN_KEY = 'com.apple.developer.applesignin';
const SIGNIN_ENTRY = `\t<key>${SIGNIN_KEY}</key>\n\t<array>\n\t\t<string>Default</string>\n\t</array>\n`;

const FRESH_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${SIGNIN_ENTRY}</dict>
</plist>
`;

// ── 1. Entitlements (create or merge — patch-ios-push may have written it) ──
if (!existsSync(ENTITLEMENTS)) {
  writeFileSync(ENTITLEMENTS, FRESH_ENTITLEMENTS, 'utf-8');
  console.log('[patch-ios-apple-signin] ✚ Wrote App.entitlements (applesignin: Default)');
} else {
  const current = readFileSync(ENTITLEMENTS, 'utf-8');
  if (current.includes(SIGNIN_KEY)) {
    console.log('[patch-ios-apple-signin] ✓ applesignin entitlement already present');
  } else {
    const dictClose = current.lastIndexOf('</dict>');
    if (dictClose === -1) throw new Error('[patch-ios-apple-signin] no </dict> in App.entitlements');
    writeFileSync(
      ENTITLEMENTS,
      current.slice(0, dictClose) + SIGNIN_ENTRY + current.slice(dictClose),
      'utf-8',
    );
    console.log('[patch-ios-apple-signin] ✚ Merged applesignin into existing App.entitlements');
  }
}

// ── 2. CODE_SIGN_ENTITLEMENTS build setting ──────────────────────────────
let pbxproj = readFileSync(PBXPROJ, 'utf-8');
if (pbxproj.includes('CODE_SIGN_ENTITLEMENTS')) {
  console.log('[patch-ios-apple-signin] ✓ CODE_SIGN_ENTITLEMENTS already set');
} else {
  // only the app target's buildSettings blocks carry PRODUCT_BUNDLE_IDENTIFIER
  const before = pbxproj;
  pbxproj = pbxproj.replace(
    /(\n(\t+)PRODUCT_BUNDLE_IDENTIFIER = )/g,
    '\n$2CODE_SIGN_ENTITLEMENTS = App/App.entitlements;$1',
  );
  if (pbxproj === before) {
    throw new Error('[patch-ios-apple-signin] PRODUCT_BUNDLE_IDENTIFIER anchor not found');
  }
  writeFileSync(PBXPROJ, pbxproj, 'utf-8');
  console.log('[patch-ios-apple-signin] ✚ Set CODE_SIGN_ENTITLEMENTS on app target');
}

console.log('[patch-ios-apple-signin] Done');
