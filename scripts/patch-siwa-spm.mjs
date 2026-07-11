#!/usr/bin/env node
/**
 * @capacitor-community/apple-sign-in 7.1.0 (latest) pins capacitor-swift-pm
 * 7.0.0..<8.0.0, which conflicts with every other plugin on Capacitor 8 and
 * makes SPM resolution fail for the whole ios/ project. The plugin's Swift
 * (AuthenticationServices only) compiles fine against 8 — widen the range.
 *
 * Runs after npm install / before any iOS build; idempotent.
 * Usage: node scripts/patch-siwa-spm.mjs  (wired into `npm run cap:sync`)
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const PKG = resolve('node_modules/@capacitor-community/apple-sign-in/Package.swift');

if (!existsSync(PKG)) {
  console.log('[patch-siwa-spm] plugin not installed — skipping');
  process.exit(0);
}

const src = readFileSync(PKG, 'utf-8');
if (src.includes('from: "8.0.0"')) {
  console.log('[patch-siwa-spm] ✓ already widened to 8.x');
} else if (src.includes('from: "7.0.0"')) {
  writeFileSync(PKG, src.replace('from: "7.0.0"', 'from: "8.0.0"'), 'utf-8');
  console.log('[patch-siwa-spm] ✚ widened capacitor-swift-pm to 8.x');
} else {
  console.warn('[patch-siwa-spm] ⚠ unexpected Package.swift — check plugin version');
}
