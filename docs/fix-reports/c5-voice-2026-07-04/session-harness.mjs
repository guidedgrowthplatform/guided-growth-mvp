// C5 voice spot-pass session runner (context lane, 2026-07-04).
// One Vapi session per invocation; context closes at the end = session killed.
// Usage: node session.mjs --name V1-profile --wav /tmp/c5/wav/profile.wav \
//          --startAt profile --mode watch --duration 75
import { chromium } from '/Users/jonah/Documents/guided-growth-mvp/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const NAME = arg('name', 'session');
const WAV = arg('wav');
const START_AT = arg('startAt', 'profile');
const MODE = arg('mode', 'watch'); // watch | b31
const DURATION = Number(arg('duration', '75')) * 1000;
const BASE = arg('base', 'https://gg-qa-iota.vercel.app');
const OUT = `/tmp/c5/out/${NAME}`;
mkdirSync(OUT, { recursive: true });

const t0 = Date.now();
const ts = () => ((Date.now() - t0) / 1000).toFixed(1);
const mark = (line) => {
  appendFileSync(`${OUT}/timeline.log`, `[${ts()}s] ${line}\n`);
  console.log(`[${ts()}s] ${line}`);
};

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${WAV}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('gg_vapi_enabled', 'true');
  } catch {}
});
const page = await ctx.newPage();

page.on('console', (m) =>
  appendFileSync(`${OUT}/console.jsonl`, JSON.stringify({ t: ts(), type: m.type(), text: m.text().slice(0, 2000) }) + '\n'),
);
page.on('pageerror', (e) => appendFileSync(`${OUT}/console.jsonl`, JSON.stringify({ t: ts(), type: 'pageerror', text: String(e).slice(0, 2000) }) + '\n'));
page.on('response', async (r) => {
  const u = r.url();
  if (/vapi\.ai|daily\.co|\/api\/|supabase\.co\/rest|soniox|cartesia/.test(u))
    appendFileSync(`${OUT}/network.jsonl`, JSON.stringify({ t: ts(), status: r.status(), method: r.request().method(), url: u.slice(0, 220) }) + '\n');
});
page.on('websocket', (ws) => mark(`WEBSOCKET open ${ws.url().slice(0, 120)}`));

const snap = async (label) => {
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: false }).catch(() => {});
};
let lastText = '';
const thread = async () => {
  const txt = await page.evaluate(() => document.body.innerText).catch(() => '');
  if (txt && txt !== lastText) {
    appendFileSync(`${OUT}/thread.log`, `\n===== [${ts()}s] =====\n${txt}\n`);
    lastText = txt;
    return { changed: true, txt };
  }
  return { changed: false, txt: lastText };
};

const clickIf = async (selector, label, timeout = 3000) => {
  try {
    const el = page.locator(selector).first();
    await el.waitFor({ state: 'visible', timeout });
    await el.click();
    mark(`clicked ${label}`);
    return true;
  } catch {
    return false;
  }
};

const LOGIN = process.env.QA_EMAIL_C5;
if (LOGIN) {
  mark(`login as ${LOGIN}`);
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder="Email Address"]', LOGIN);
  await page.fill('input[placeholder="Password"]', process.env.QA_PASSWORD_C5 || '');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(6000);
  mark(`post-login url: ${page.url()}`);
}

const TARGET = arg('path', `/onboarding-flow-preview?startAt=${START_AT}`);
mark(`goto ${BASE}${TARGET} wav=${WAV} mode=${MODE}`);
await page.goto(`${BASE}${TARGET}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await snap('01-loaded');
await thread();

// IntroGate / get-started (gesture unlock), tap-to-play pill, mic allow.
await clickIf('button:has-text("Get started")', 'Get started', 6000);
await page.waitForTimeout(2000);
await clickIf('[aria-label="Tap to play the coach audio"]', 'tap-to-play pill', 4000);

// Arm loop: keep trying the mic grant / mic-on until the Vapi call is live
// (websocket to daily.co/vapi) or 40s pass. The orb renders late on fastForward.
let wsOpen = false;
page.on('websocket', (ws) => {
  if (/daily|vapi/.test(ws.url())) wsOpen = true;
});
const armEnd = Date.now() + 45_000;
while (Date.now() < armEnd && !wsOpen) {
  // Mic beat card / permission prompts on the real flow.
  await clickIf('button:has-text("Allow")', 'Allow (card)', 1200);
  if (await clickIf('[aria-label="Allow microphone"]', 'Allow microphone (orb)', 1200)) {
    await page.waitForTimeout(1500);
  }
  const micOn = await page.locator('[aria-label="Turn mic off"]').count().catch(() => 0);
  if (micOn > 0) {
    mark('mic is ON (Turn mic off visible)');
    break;
  }
  await clickIf('[aria-label="Turn mic on"]', 'Turn mic on', 1200);
  await page.waitForTimeout(1800);
}
mark(`arm loop done, ws=${wsOpen}`);
await snap('02-armed');
await thread();

if (MODE === 'b31') {
  // Phase 1: wait for evidence of an assistant reply to our looping utterance.
  mark('B31 phase 1: waiting for first assistant response (up to 60s)');
  const p1End = Date.now() + 60_000;
  let phase1Len = 0;
  while (Date.now() < p1End) {
    await page.waitForTimeout(2500);
    const { txt } = await thread();
    phase1Len = txt.length;
  }
  await snap('03-before-pause');
  const beforePause = lastText;

  mark('B31: PAUSING mic (Turn mic off)');
  const paused = await clickIf('[aria-label="Turn mic off"]', 'Turn mic off', 5000);
  if (!paused) mark('B31: mic-off button NOT FOUND — dumping aria snapshot');
  await page.waitForTimeout(4000);
  await snap('04-paused');

  mark('B31: RESUMING mic (Turn mic on)');
  const resumed = await clickIf('[aria-label="Turn mic on"]', 'Turn mic on', 5000);
  if (!resumed) mark('B31: mic-on button NOT FOUND');
  await snap('05-resumed');

  mark('B31 phase 2: utterance loop continues — watching 50s for ANY new assistant text');
  const p2End = Date.now() + 50_000;
  let changedAfterResume = false;
  while (Date.now() < p2End) {
    await page.waitForTimeout(2500);
    const { changed, txt } = await thread();
    if (changed && txt.length > beforePause.length + 10) changedAfterResume = true;
  }
  mark(`B31 verdict-input: thread grew after resume = ${changedAfterResume}`);
  await snap('06-final');
} else {
  const end = Date.now() + DURATION;
  while (Date.now() < end) {
    await page.waitForTimeout(3000);
    await thread();
  }
  await snap('06-final');
}

// Aria dump of the orb area for diagnostics.
const buttons = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button')).map((b) => b.getAttribute('aria-label') || b.textContent?.slice(0, 40)),
).catch(() => []);
writeFileSync(`${OUT}/buttons.json`, JSON.stringify(buttons, null, 2));
mark('closing context (killing Vapi session)');
await ctx.close();
await browser.close();
mark('done');
