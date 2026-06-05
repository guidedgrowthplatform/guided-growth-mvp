import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const logoSvg = readFileSync(new URL('../public/logo.svg', import.meta.url), 'utf8');

// single source of truth: brand color read from logo.svg
const BLUE = logoSvg.match(/#[0-9A-Fa-f]{6}/)?.[0];
if (!BLUE) throw new Error('build-icon: no hex color found in public/logo.svg');

const SIZE = 1024;
const SPLASH = 2732; // @capacitor/assets splash source size
const SAFE = 0.62; // swoosh fills ~62% of the square; rest is padding/safe-zone

// GG mark = ribbon + 4 dots + right-G body + left-G crossbar; wordmark dropped.
// Sliced live from logo.svg (swoosh start → crossbar close) so it can't drift like a hand-copied path.
const markStart = logoSvg.indexOf('M2935 7084');
const crossbarStart = logoSvg.indexOf('M2451 4604', markStart);
const markEnd = crossbarStart === -1 ? -1 : logoSvg.indexOf('z', crossbarStart) + 1;
if (markStart === -1 || crossbarStart === -1 || markEnd === 0) {
  throw new Error('build-icon: GG mark subpaths not found in public/logo.svg — re-sync extraction');
}
const swoosh = logoSvg.slice(markStart, markEnd).replace(/\s+/g, ' ').trim();

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
