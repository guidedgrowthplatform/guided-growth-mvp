// Run from a worktree root that has node_modules (e.g. the loop1 worktree):
//   node ../gg-status/docs/fix-reports/preview-walker.mjs <url> [blocked]
// Bare-specifier resolution walks up from THIS file, so keep a copy next to
// node_modules or set NODE_PATH; simplest is `cp` into the worktree root.
import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'https://gg-kxtkk853f-guided-growths-projects.vercel.app/onboarding-flow-preview';
const AUTOPLAY = process.argv[3] !== 'blocked';

const browser = await chromium.launch({
  args: AUTOPLAY ? ['--autoplay-policy=no-user-gesture-required'] : [],
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const consoleLines = [];
const mp3Log = [];
let flowMountAt = 0;
page.on('console', (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
page.on('response', (r) => {
  if (r.url().includes('.mp3')) mp3Log.push({ t: Date.now(), s: r.status(), f: r.url().split('/').pop() });
});
page.on('pageerror', (e) => consoleLines.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(3000);
const gate = page.locator('button', { hasText: 'Get started' });
if (await gate.count()) await gate.first().click();

const EXCLUDE = /Tanstack|Vapi|QA|🔊|account/i;
const CTAS = ['Continue', "Let's go", 'Start my plan', 'Next', 'Allow', 'Skip', 'Not now', 'Done', 'Save'];
const seen = [];
let lastBeat = '';

for (let step = 0; step < 90; step++) {
  await page.waitForTimeout(2000);
  // close devtools if it ever opens
  const closeDt = page.locator('button[aria-label*="Close"], button:has-text("Close Tanstack")');
  try { if (await closeDt.count()) await closeDt.first().click({ timeout: 800 }); } catch {}

  const text = await page.evaluate(() => document.body.innerText);
  const firstLine = text.split('\n').filter(l => l.trim().length > 8)[1] ?? '';
  if (firstLine !== lastBeat) {
    lastBeat = firstLine;
    seen.push(`${step}: ${firstLine.slice(0, 90)}`);
    if (!flowMountAt && mp3Log.some(m => m.f.startsWith('ONBOARD') || m.f.startsWith('mic'))) flowMountAt = step;
  }

  let acted = false;
  for (const label of CTAS) {
    const b = page.locator(`button:has-text("${label}")`).first();
    try {
      if ((await b.count()) && (await b.isVisible()) && (await b.isEnabled())) { await b.click({ timeout: 1500 }); acted = true; break; }
    } catch {}
  }
  if (!acted) {
    // pickers: click option buttons that are NOT chrome buttons
    const buttons = await page.locator('button:visible').all();
    let clicks = 0;
    for (const b of buttons) {
      if (clicks >= 5) break;
      const label = ((await b.textContent()) ?? '') + ((await b.getAttribute('aria-label')) ?? '');
      if (EXCLUDE.test(label) || CTAS.some(c => label.includes(c))) continue;
      try { await b.click({ timeout: 1000 }); clicks++; acted = true; } catch {}
    }
  }
  if (!acted) {
    // gesture tap on the feed (unlocks audio; some intros advance on tap)
    try { await page.mouse.click(210, 420); acted = true; } catch {}
  }
  if (/WEEKLY-PROJECTION-GAPS|final|You.re in/i.test(text)) break;
}

console.log('=== BEAT/TEXT TRANSITIONS ===');
console.log(seen.join('\n'));
const uniq = [...new Set(mp3Log.map(m => `${m.s} ${m.f}`))];
console.log(`=== MP3 RESPONSES (${mp3Log.length} total, ${uniq.length} uniq) ===`);
console.log(uniq.join('\n'));
const diag = consoleLines.filter(l => /opener|Mp3|autoplay|NotAllowed|canplay|preload|fail(?!ed to load resource)|pageerror/i.test(l) && !/Tanstack/.test(l));
console.log(`=== DIAGNOSTICS (${diag.length}) ===`);
console.log([...new Set(diag)].slice(0, 50).join('\n'));
await page.screenshot({ path: '/tmp/gg-verify/walk2-end.png' });
await browser.close();
