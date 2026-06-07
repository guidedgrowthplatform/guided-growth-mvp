#!/usr/bin/env node
// qa/staging swaps the red *-qa.png set onto the canonical icon masters
// before @capacitor/assets generate; prod is a no-op. Mutates in place.
// Usage: node scripts/select-icon-master.mjs <environment|flavor>

import { copyFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import sharp from 'sharp';

const LAYERS = ['icon.png', 'icon-foreground.png', 'icon-background.png'];
const ASSETS = resolve('assets');
const SIZE = 1024;
// Android adaptive foreground keeps art inside the inner ~66% safe zone
const FG_SCALE = 0.66;

const qaName = (layer) => layer.replace(/\.png$/, '-qa.png');
const qaPath = (layer) => resolve(ASSETS, qaName(layer));

// Android passes the flavor ('qa'), iOS passes the env ('staging') — both → red
const QA_TARGETS = new Set(['qa', 'staging']);

const target = (process.argv[2] ?? '').toLowerCase();

if (!QA_TARGETS.has(target)) {
  console.log(`[select-icon-master] '${target || '(none)'}' → blue (default masters, no-op)`);
  process.exit(0);
}

const flat = qaPath('icon.png');
if (!existsSync(flat)) {
  console.error(`[select-icon-master] qa build requested but ${qaName('icon.png')} is missing.`);
  process.exit(1);
}

// Derive the two adaptive layers from the single flat master when absent, so a
// drop-in icon-qa.png is all that's needed (Android needs separate fg + bg).
await deriveAdaptiveLayers();

for (const layer of LAYERS) {
  copyFileSync(qaPath(layer), resolve(ASSETS, layer));
  console.log(`[select-icon-master] ✚ ${layer} ← ${qaName(layer)}`);
}
console.log('[select-icon-master] red (qa) masters selected');

async function deriveAdaptiveLayers() {
  const bg = qaPath('icon-background.png');
  const fg = qaPath('icon-foreground.png');
  if (existsSync(bg) && existsSync(fg)) return;

  const flatBuf = await sharp(flat).resize(SIZE, SIZE, { fit: 'cover' }).toBuffer();
  const { dominant } = await sharp(flatBuf).stats();

  if (!existsSync(bg)) {
    await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: dominant } })
      .png()
      .toFile(bg);
    console.log(`[select-icon-master] + derived ${qaName('icon-background.png')} (solid)`);
  }
  if (!existsSync(fg)) {
    const inner = Math.round(SIZE * FG_SCALE);
    const art = await sharp(flatBuf).resize(inner, inner, { fit: 'contain' }).toBuffer();
    await sharp({
      create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: art, gravity: 'center' }])
      .png()
      .toFile(fg);
    console.log(`[select-icon-master] + derived ${qaName('icon-foreground.png')} (safe-zone)`);
  }
}
