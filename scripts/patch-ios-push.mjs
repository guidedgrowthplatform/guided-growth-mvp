#!/usr/bin/env node
/**
 * Patches the regenerated ios/ project for push notifications after
 * `cap sync ios` (same model as patch-ios-plist.mjs — ios/ is gitignored,
 * so every push-related native change must be re-applied on each build):
 *
 *   1. AppDelegate.swift — APNs forwarding methods @capacitor-firebase/messaging
 *      requires; without them iOS push silently never registers.
 *   2. App.entitlements with aps-environment + CODE_SIGN_ENTITLEMENTS in pbxproj.
 *   3. GoogleService-Info.plist copied from assets/firebase/ into the app
 *      target's Resources build phase.
 *
 * Usage: node scripts/patch-ios-push.mjs
 * Called by `npm run cap:sync` / `cap:sync:all` and the ios-testflight CI job.
 */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const APP_DELEGATE = resolve('ios/App/App/AppDelegate.swift');
const PBXPROJ = resolve('ios/App/App.xcodeproj/project.pbxproj');
const ENTITLEMENTS = resolve('ios/App/App/App.entitlements');
const PLIST_DEST = resolve('ios/App/App/GoogleService-Info.plist');

// Per-env plist by bundle id; fall back to legacy unsuffixed file.
const APP_ID = process.env.APP_IDENTIFIER || 'app.guidedgrowth.mvp';
const VARIANT = APP_ID.split('.').pop();
const PLIST_SOURCE = [
  resolve(`assets/firebase/GoogleService-Info.${VARIANT}.plist`),
  resolve('assets/firebase/GoogleService-Info.plist'),
].find(existsSync);

if (!existsSync(APP_DELEGATE) || !existsSync(PBXPROJ)) {
  console.log('[patch-ios-push] ios project not found — skipping (run cap sync ios first)');
  process.exit(0);
}

// ── 1. AppDelegate forwarding methods ────────────────────────────────────
const FORWARDING_METHODS = `
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(name: Notification.Name.init("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
    }
`;

let appDelegate = readFileSync(APP_DELEGATE, 'utf-8');
if (appDelegate.includes('didRegisterForRemoteNotificationsWithDeviceToken')) {
  console.log('[patch-ios-push] ✓ AppDelegate forwarding methods already present');
} else {
  const closeIdx = appDelegate.lastIndexOf('}');
  if (closeIdx === -1) throw new Error('[patch-ios-push] no closing brace in AppDelegate.swift');
  appDelegate = appDelegate.slice(0, closeIdx) + FORWARDING_METHODS + '\n' + appDelegate.slice(closeIdx);
  writeFileSync(APP_DELEGATE, appDelegate, 'utf-8');
  console.log('[patch-ios-push] ✚ Added APNs forwarding methods to AppDelegate.swift');
}

// ── 2. Entitlements + plist (per-env Firebase config) ─────
// missing plist → skip entitlements; Firebase still crashes until added
if (!PLIST_SOURCE) {
  console.warn(
    `[patch-ios-push] ⚠ no GoogleService-Info plist for ${APP_ID} (looked for GoogleService-Info.${VARIANT}.plist) — Firebase will crash at launch; add it under assets/firebase/`,
  );
  process.exit(0);
}
console.log(`[patch-ios-push] using ${PLIST_SOURCE.split('/').slice(-1)[0]} for ${APP_ID}`);

const ENTITLEMENTS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key>
	<string>production</string>
</dict>
</plist>
`;

if (existsSync(ENTITLEMENTS)) {
  console.log('[patch-ios-push] ✓ App.entitlements already present');
} else {
  writeFileSync(ENTITLEMENTS, ENTITLEMENTS_XML, 'utf-8');
  console.log('[patch-ios-push] ✚ Wrote App.entitlements (aps-environment: production)');
}

let pbxproj = readFileSync(PBXPROJ, 'utf-8');
let pbxChanged = false;

if (pbxproj.includes('CODE_SIGN_ENTITLEMENTS')) {
  console.log('[patch-ios-push] ✓ CODE_SIGN_ENTITLEMENTS already set');
} else {
  // only the app target's buildSettings blocks carry PRODUCT_BUNDLE_IDENTIFIER
  const before = pbxproj;
  pbxproj = pbxproj.replace(
    /(\n(\t+)PRODUCT_BUNDLE_IDENTIFIER = )/g,
    '\n$2CODE_SIGN_ENTITLEMENTS = App/App.entitlements;$1',
  );
  if (pbxproj === before) throw new Error('[patch-ios-push] PRODUCT_BUNDLE_IDENTIFIER anchor not found');
  pbxChanged = true;
  console.log('[patch-ios-push] ✚ Set CODE_SIGN_ENTITLEMENTS on app target');
}

// ── 3. GoogleService-Info.plist ──────────────────────────────────────────
// fixed 24-hex IDs keep re-runs idempotent
const FILE_REF_ID = 'AA66778899001122334455FF';
const BUILD_FILE_ID = 'AA66778899001122334455FE';

{
  copyFileSync(PLIST_SOURCE, PLIST_DEST);
  console.log('[patch-ios-push] ✚ Copied GoogleService-Info.plist into app target');

  if (!pbxproj.includes(FILE_REF_ID)) {
    pbxproj = pbxproj.replace(
      '/* Begin PBXBuildFile section */',
      `/* Begin PBXBuildFile section */\n\t\t${BUILD_FILE_ID} /* GoogleService-Info.plist in Resources */ = {isa = PBXBuildFile; fileRef = ${FILE_REF_ID} /* GoogleService-Info.plist */; };`,
    );
    pbxproj = pbxproj.replace(
      '/* Begin PBXFileReference section */',
      `/* Begin PBXFileReference section */\n\t\t${FILE_REF_ID} /* GoogleService-Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; name = "GoogleService-Info.plist"; path = "App/GoogleService-Info.plist"; sourceTree = SOURCE_ROOT; };`,
    );
    pbxproj = pbxproj.replace(
      /(isa = PBXResourcesBuildPhase;[\s\S]*?files = \(\n)/,
      `$1\t\t\t\t${BUILD_FILE_ID} /* GoogleService-Info.plist in Resources */,\n`,
    );
    if (!pbxproj.includes(BUILD_FILE_ID)) {
      throw new Error('[patch-ios-push] failed to register GoogleService-Info.plist in pbxproj');
    }
    pbxChanged = true;
    console.log('[patch-ios-push] ✚ Registered GoogleService-Info.plist in Resources phase');
  } else {
    console.log('[patch-ios-push] ✓ GoogleService-Info.plist already registered');
  }
}

if (pbxChanged) writeFileSync(PBXPROJ, pbxproj, 'utf-8');
console.log('[patch-ios-push] Done');
