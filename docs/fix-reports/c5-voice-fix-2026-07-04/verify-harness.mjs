// C5 identical-turns fix verification (adapted from docs/fix-reports/c5-voice-2026-07-04/session-harness.mjs).
// Fake-mic WAV loops one utterance 5x with 1.3s gaps; counts POST /api/llm
// dispatches that carry a user_message (turn dispatches, openers excluded).
import { chromium } from '/Users/tv01d/Downloads/growthproject/guided-growth-mvp/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const NAME = arg('name', 'verify');
const WAV = arg('wav');
const START_AT = arg('startAt', 'category');
const DURATION = Number(arg('duration', '90')) * 1000;
const BASE = arg('base');
const OUT = `/private/tmp/claude-501/-Users-tv01d-Downloads-growthproject-guided-growth-mvp/67b92216-ff87-4969-af18-c5298970b309/scratchpad/out/${NAME}`;
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
    localStorage.setItem('gg_vapi_enabled', 'false');
  } catch {}
});
const page = await ctx.newPage();

page.on('console', (m) =>
  appendFileSync(
    `${OUT}/console.jsonl`,
    JSON.stringify({ t: ts(), type: m.type(), text: m.text().slice(0, 2000) }) + '\n',
  ),
);
page.on('pageerror', (e) =>
  appendFileSync(`${OUT}/console.jsonl`, JSON.stringify({ t: ts(), type: 'pageerror', text: String(e).slice(0, 2000) }) + '\n'),
);
page.on('request', (r) => {
  if (r.url().includes('/api/llm') && r.method() === 'POST') {
    let body = null;
    try {
      body = JSON.parse(r.postData() ?? 'null');
    } catch {}
    appendFileSync(
      `${OUT}/llm-requests.jsonl`,
      JSON.stringify({ t: ts(), user_message: body?.user_message ?? null, mode: body?.mode ?? null, screen_id: body?.screen_id ?? null }) + '\n',
    );
    mark(`POST /api/llm user_message=${JSON.stringify(body?.user_message ?? null)}`);
  }
});
page.on('response', (r) => {
  const u = r.url();
  if (/\/api\/|soniox|cartesia/.test(u))
    appendFileSync(
      `${OUT}/network.jsonl`,
      JSON.stringify({ t: ts(), status: r.status(), method: r.request().method(), url: u.slice(0, 220) }) + '\n',
    );
});

const snap = async (label) => {
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: false }).catch(() => {});
};
let lastText = '';
const thread = async () => {
  const txt = await page.evaluate(() => document.body.innerText).catch(() => '');
  if (txt && txt !== lastText) {
    appendFileSync(`${OUT}/thread.log`, `\n===== [${ts()}s] =====\n${txt}\n`);
    lastText = txt;
  }
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

// QA login: the /onboarding/qa control screen has VITE_QA_PASSWORD baked in —
// select the fable test user and "Log in" so /api/soniox-temp-key stops 401ing.
mark('QA login via /onboarding/qa');
await page.goto(`${BASE}/onboarding/qa`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('select[aria-label="Test user"]', { timeout: 20000 });
await page.selectOption('select[aria-label="Test user"]', 'qa-onboarding-fable@guidedgrowth.test');
await page.getByRole('button', { name: 'Log in', exact: false }).first().click();
await page.waitForTimeout(6000);
mark(`post-login url: ${page.url()}`);

const TARGET = `/onboarding-flow-preview?startAt=${START_AT}`;
mark(`goto ${BASE}${TARGET} wav=${WAV}`);
await page.goto(`${BASE}${TARGET}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await snap('01-loaded');
await thread();

await clickIf('button:has-text("Get started")', 'Get started', 6000);
await page.waitForTimeout(2000);
await clickIf('[aria-label="Tap to play the coach audio"]', 'tap-to-play pill', 4000);

// Arm loop: grant mic / turn mic on until listening.
const armEnd = Date.now() + 45_000;
while (Date.now() < armEnd) {
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
await snap('02-armed');
await thread();

const end = Date.now() + DURATION;
while (Date.now() < end) {
  await page.waitForTimeout(3000);
  await thread();
}
await snap('03-final');

const buttons = await page
  .evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => b.getAttribute('aria-label') || b.textContent?.slice(0, 40)))
  .catch(() => []);
writeFileSync(`${OUT}/buttons.json`, JSON.stringify(buttons, null, 2));
mark('closing context (killing session)');
await ctx.close();
await browser.close();
mark('done');
