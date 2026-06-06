#!/usr/bin/env node
// qa/staging swaps the red *-qa.png set onto the canonical icon masters
// before @capacitor/assets generate; prod is a no-op. Mutates in place.
// Usage: node scripts/select-icon-master.mjs <environment|flavor>

import { copyFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const LAYERS = ['icon.png', 'icon-foreground.png', 'icon-background.png'];
const ASSETS = resolve('assets');

// Android passes the flavor ('qa'), iOS passes the env ('staging') — both → red
const QA_TARGETS = new Set(['qa', 'staging']);

const target = (process.argv[2] ?? '').toLowerCase();
const isQa = QA_TARGETS.has(target);

if (!isQa) {
  console.log(`[select-icon-master] '${target || '(none)'}' → blue (default masters, no-op)`);
  process.exit(0);
}

const qaName = (layer) => layer.replace(/\.png$/, '-qa.png');

const missing = LAYERS.map(qaName).filter(
  (qa) => !existsSync(resolve(ASSETS, qa)),
);
if (missing.length) {
  console.error(
    `[select-icon-master] qa build requested but missing red masters: ${missing.join(', ')}.\n` +
      'Add the 3-layer red set (icon-qa.png + -foreground + -background) before building qa.',
  );
  process.exit(1);
}

for (const layer of LAYERS) {
  copyFileSync(resolve(ASSETS, qaName(layer)), resolve(ASSETS, layer));
  console.log(`[select-icon-master] ✚ ${layer} ← ${qaName(layer)}`);
}
console.log('[select-icon-master] red (qa) masters selected');
