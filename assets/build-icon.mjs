import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const logoSvg = readFileSync(new URL('../public/logo.svg', import.meta.url), 'utf8');

// single source of truth: brand color read from logo.svg
const BLUE = logoSvg.match(/#[0-9A-Fa-f]{6}/)?.[0];
if (!BLUE) throw new Error('build-icon: no hex color found in public/logo.svg');

const SIZE = 1024;
const SPLASH = 2732; // @capacitor/assets splash source size
const SAFE = 0.62; // swoosh fills ~62% of the square; rest is padding/safe-zone

// swoosh + tapering dots, lifted from public/logo.svg (wordmark subpaths dropped)
const swoosh = `M2935 7084 c-476 -36 -827 -129 -1190 -314 -747 -381 -1336 -1066 -1550 -1802 -73 -251 -100 -464 -92 -727 15 -495 158 -918 465 -1366 412 -604 1021 -1024 1767 -1220 462 -122 1023 -123 1515 -5 739 178 1397 631 2086 1435 164 192 349 426 602 765 818 1093 916 1222 1110 1460 218 266 439 489 623 629 389 294 852 436 1359 418 266 -10 473 -50 690 -134 248 -95 389 -191 618 -420 95 -94 194 -186 219 -202 117 -78 251 -96 355 -49 142 65 219 205 188 340 -16 69 -77 185 -140 270 -105 140 -310 312 -575 483 -124 81 -389 214 -515 259 -431 154 -991 192 -1475 100 -597 -114 -1168 -435 -1578 -889 -210 -232 -709 -878 -1302 -1685 -510 -695 -692 -921 -980 -1219 -406 -419 -801 -688 -1225 -833 -571 -195 -1209 -175 -1750 55 -659 280 -1132 831 -1264 1471 -45 218 -46 497 -2 711 105 506 427 998 870 1329 404 302 849 449 1356 449 372 0 692 -74 989 -229 159 -83 278 -172 458 -347 89 -86 189 -175 222 -196 171 -110 387 -57 467 115 79 169 9 381 -188 570 -133 129 -418 337 -608 446 -284 162 -631 270 -1000 312 -137 16 -434 27 -525 20 z M7090 5520 a 280 280 0 1 0 560 0 a 280 280 0 1 0 -560 0 z M6540 4730 a 210 210 0 1 0 420 0 a 210 210 0 1 0 -420 0 z M6070 3990 a 140 140 0 1 0 280 0 a 140 140 0 1 0 -280 0 z M5635 3350 a 65 65 0 1 0 130 0 a 65 65 0 1 0 -130 0 z`;

// drift guard: fail loud if logo.svg redesigned without re-syncing the swoosh above
const norm = (s) => s.replace(/\s+/g, ' ').trim();
if (!norm(logoSvg).includes(norm(swoosh))) {
  throw new Error('build-icon: swoosh no longer matches public/logo.svg — re-sync the path');
}

const swooshSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1225" height="719" viewBox="0 0 1225 719">
<g transform="translate(0,719) scale(0.1,-0.1)" fill="#ffffff" stroke="none"><path d="${swoosh}"/></g>
</svg>`;

// render at high res, trim transparent margins to get the tight mark
const rendered = await sharp(Buffer.from(swooshSvg), { density: 600 })
  .png()
  .toBuffer();
const trimmed = await sharp(rendered).trim().toBuffer();
const meta = await sharp(trimmed).metadata();

// fit factor differs: flat icon fills more; adaptive foreground must clear the ~33% crop
async function markAt(fit) {
  const target = Math.round(SIZE * fit);
  const scale = target / Math.max(meta.width, meta.height);
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  const buf = await sharp(trimmed).resize(w, h, { fit: 'fill' }).toBuffer();
  return { buf, left: Math.round((SIZE - w) / 2), top: Math.round((SIZE - h) / 2), w, h };
}

const blueSquare = () => sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: BLUE } });
const clearSquare = () => sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: '#00000000' } });

const flat = await markAt(SAFE);
const fg = await markAt(0.46);

const out = (name, buf) => writeFileSync(new URL(`./${name}`, import.meta.url), buf);

// flatten icon + background to RGB (no alpha) — Apple rejects alpha in app icons; foreground keeps alpha
const iconComposed = await blueSquare().composite([{ input: flat.buf, left: flat.left, top: flat.top }]).png().toBuffer();
out('icon.png', await sharp(iconComposed).flatten({ background: BLUE }).png().toBuffer());
out('icon-foreground.png', await clearSquare().composite([{ input: fg.buf, left: fg.left, top: fg.top }]).png().toBuffer());
out('icon-background.png', await blueSquare().flatten({ background: BLUE }).png().toBuffer());

// splash: small centered swoosh on blue — @capacitor/assets needs splash.png + splash-dark.png or it skips splash
const splashFit = 0.22;
const sTarget = Math.round(SPLASH * splashFit);
const sScale = sTarget / Math.max(meta.width, meta.height);
const sw = Math.round(meta.width * sScale);
const sh = Math.round(meta.height * sScale);
const splashMark = await sharp(trimmed).resize(sw, sh, { fit: 'fill' }).toBuffer();
const splash = await sharp({ create: { width: SPLASH, height: SPLASH, channels: 4, background: BLUE } })
  .composite([{ input: splashMark, left: Math.round((SPLASH - sw) / 2), top: Math.round((SPLASH - sh) / 2) }])
  .flatten({ background: BLUE })
  .png()
  .toBuffer();
out('splash.png', splash);
out('splash-dark.png', splash);
console.log(`icon.png (mark ${flat.w}x${flat.h}), icon-foreground.png (mark ${fg.w}x${fg.h}), icon-background.png — all ${SIZE}x${SIZE}; splash.png + splash-dark.png ${SPLASH}x${SPLASH} (mark ${sw}x${sh})`);
