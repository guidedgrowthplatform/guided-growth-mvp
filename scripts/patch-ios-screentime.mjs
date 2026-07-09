#!/usr/bin/env node
/**
 * Re-injects the Screen Time (Family Controls) plumbing on the APP target
 * after `cap sync ios`, in case anyone regenerates ios/ from scratch:
 *
 *   1. com.apple.developer.family-controls + App Group in App.entitlements.
 *   2. NSFamilyControlsUsageDescription in Info.plist.
 *   3. PrivacyInfo.xcprivacy (NSPrivacyTracking=false, App-Group UserDefaults
 *      required-reason 1C8F.1).
 *
 * ios/ is COMMITTED (source of truth) since the four Screen Time extension
 * targets cannot be recreated by a script — this patch is the safety net for
 * the app target only, not a substitute for the committed project.
 *
 * ORDERING: after patch-ios-apple-signin.mjs (merges into its entitlements).
 * Usage: node scripts/patch-ios-screentime.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const PLIST_PATH = resolve('ios/App/App/Info.plist');
const ENTITLEMENTS = resolve('ios/App/App/App.entitlements');
const PRIVACY_MANIFEST = resolve('ios/App/App/PrivacyInfo.xcprivacy');

const APP_GROUP = 'group.app.guidedgrowth.screentime';
const FC_KEY = 'com.apple.developer.family-controls';
const AG_KEY = 'com.apple.security.application-groups';

if (!existsSync(ENTITLEMENTS)) {
  console.log('[patch-ios-screentime] App.entitlements not found — skipping (run patch-ios-apple-signin first)');
  process.exit(0);
}

// ── 1. Entitlements: family-controls + app group ─────────────────────────
let ents = readFileSync(ENTITLEMENTS, 'utf-8');
let entsPatched = false;
const ENT_ENTRIES = [
  { key: FC_KEY, xml: `\t<key>${FC_KEY}</key>\n\t<true/>\n` },
  {
    key: AG_KEY,
    xml: `\t<key>${AG_KEY}</key>\n\t<array>\n\t\t<string>${APP_GROUP}</string>\n\t</array>\n`,
  },
];
for (const { key, xml } of ENT_ENTRIES) {
  if (ents.includes(`<key>${key}</key>`)) {
    console.log(`[patch-ios-screentime] ✓ ${key} already present`);
    continue;
  }
  const dictClose = ents.lastIndexOf('</dict>');
  if (dictClose === -1) throw new Error('[patch-ios-screentime] no </dict> in App.entitlements');
  ents = ents.slice(0, dictClose) + xml + ents.slice(dictClose);
  entsPatched = true;
  console.log(`[patch-ios-screentime] ✚ Added ${key}`);
}
if (entsPatched) writeFileSync(ENTITLEMENTS, ents, 'utf-8');

// ── 2. Info.plist: NSFamilyControlsUsageDescription ──────────────────────
if (existsSync(PLIST_PATH)) {
  let plist = readFileSync(PLIST_PATH, 'utf-8');
  const KEY = 'NSFamilyControlsUsageDescription';
  if (plist.includes(`<key>${KEY}</key>`)) {
    console.log(`[patch-ios-screentime] ✓ ${KEY} already present`);
  } else {
    const insertion = `\t<key>${KEY}</key>\n\t<string>Guided Growth uses Screen Time to help you see your own app usage and stay within the daily limits you set for yourself.</string>\n`;
    // last </dict> — first one can be nested inside CFBundleURLTypes
    const closeIdx = plist.lastIndexOf('</dict>');
    if (closeIdx === -1) throw new Error('[patch-ios-screentime] no </dict> in Info.plist');
    plist = plist.slice(0, closeIdx) + insertion + plist.slice(closeIdx);
    writeFileSync(PLIST_PATH, plist, 'utf-8');
    console.log(`[patch-ios-screentime] ✚ Added ${KEY}`);
  }
}

// ── 3. PrivacyInfo.xcprivacy (create only — committed file wins) ─────────
if (existsSync(PRIVACY_MANIFEST)) {
  console.log('[patch-ios-screentime] ✓ PrivacyInfo.xcprivacy already present');
} else {
  // 1C8F.1 = App-Group UserDefaults access (not CA92.1, which is same-app only)
  writeFileSync(
    PRIVACY_MANIFEST,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSPrivacyTracking</key>
	<false/>
	<key>NSPrivacyTrackingDomains</key>
	<array/>
	<key>NSPrivacyCollectedDataTypes</key>
	<array/>
	<key>NSPrivacyAccessedAPITypes</key>
	<array>
		<dict>
			<key>NSPrivacyAccessedAPIType</key>
			<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
			<key>NSPrivacyAccessedAPITypeReasons</key>
			<array>
				<string>1C8F.1</string>
			</array>
		</dict>
	</array>
</dict>
</plist>
`,
    'utf-8',
  );
  console.log('[patch-ios-screentime] ✚ Wrote PrivacyInfo.xcprivacy');
}

console.log('[patch-ios-screentime] Done');
