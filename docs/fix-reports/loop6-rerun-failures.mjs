// Focused re-run of the walker's failed/ambiguous steps, hardened waits + diagnostics.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.PREVIEW_URL;
const OUT = '/tmp/gg-verify-loop6';
const results = [];
const record = (id, verdict, evidence) => {
  results.push({ id, verdict, evidence });
  console.log(`[${verdict}] ${id} :: ${evidence}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext();
const net = [];
const attach = (page) => {
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/api/qa/self-reset') || u.includes('onboarding_states')) net.push({ t: Date.now(), m: r.method(), u });
  });
  page.on('response', (r) => {
    if (r.url().includes('/api/qa/self-reset')) net.push({ t: Date.now(), m: 'RESP', u: r.url(), status: r.status() });
  });
};
const resetCount = () => net.filter((n) => n.m === 'POST' && n.u.includes('self-reset')).length;

const newQaPage = async (tries = 2) => {
  const page = await ctx.newPage();
  attach(page);
  for (let i = 0; i < tries; i++) {
    try {
      await page.goto(`${BASE}/onboarding/qa`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('select[aria-label="Test user"]', { timeout: 25000 });
      await page.selectOption('select[aria-label="Test user"]', 'qa-onboarding-fable@guidedgrowth.test');
      return page;
    } catch (e) {
      if (i === tries - 1) throw e;
    }
  }
};

const step = async (id, fn) => {
  try { await fn(); } catch (e) { record(id, 'ERROR', String(e).split('\n')[0]); }
};

// ---- row 11 + row 2 warm heap, with error-line diagnostics
await step('row11+row2', async () => {
  const page = await newQaPage();
  let before = resetCount();
  await page.click('button:has-text("Reset data only")');
  let noticed = true;
  try {
    await page.waitForFunction(() => !!document.body.textContent?.includes('Data wiped for'), { timeout: 60000 });
  } catch { noticed = false; }
  const bodyTxt = ((await page.textContent('body')) ?? '').slice(0, 600);
  await page.screenshot({ path: `${OUT}/row11-reset-stays.png` });
  record('row11-reset-stays',
    noticed && page.url().includes('/onboarding/qa') && resetCount() === before + 1 ? 'PASS' : 'FAIL',
    `noticed=${noticed}; url=${page.url()}; resets=+${resetCount() - before}; body="${bodyTxt.slice(0, 200)}"`);

  before = resetCount();
  const netMark = net.length;
  await page.click('button[aria-label="Start Full onboarding fresh"]');
  await page.waitForURL('**/onboarding/flow', { timeout: 60000 });
  await page.waitForTimeout(8000);
  const resetAt = net.slice(netMark).find((n) => n.m === 'POST' && n.u.includes('self-reset'))?.t;
  const stateReadAfter = net.slice(netMark).some(
    (n) => n.m === 'GET' && n.u.includes('onboarding_states') && resetAt && n.t > resetAt);
  await page.screenshot({ path: `${OUT}/row2-full-onboarding.png` });
  record('row2-full-onboarding-fresh', resetCount() === before + 1 ? 'PASS' : 'FAIL',
    `wipe=+${resetCount() - before}; landed=${page.url()}`);
  record('row2-b22-fresh-state-read', stateReadAfter ? 'PASS' : 'FAIL',
    `onboarding_states GET after warm-heap reset: ${stateReadAfter}`);
  await page.close();
});

// ---- row 10 replay
await step('row10-replay-no-wipe', async () => {
  const page = await newQaPage();
  const before = resetCount();
  await page.click('button:has-text("Replay flow (preview)")');
  await page.waitForURL('**/onboarding-flow-preview', { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/row10-replay-preview.png` });
  record('row10-replay-no-wipe', resetCount() === before ? 'PASS' : 'FAIL',
    `self-resets: ${resetCount() - before}; landed=${page.url()}`);
  await page.close();
});

// ---- row 8 login
await step('row8-login-real-routing', async () => {
  const page = await newQaPage();
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/onboarding/flow', { timeout: 60000 });
  await page.screenshot({ path: `${OUT}/row8-login.png` });
  record('row8-login-real-routing', 'PASS', `landed=${page.url()}`);
  await page.close();
});

// ---- rows 3/4 startAt tiles with active-card probes (poll up to 30s)
for (const [id, label, q, probeFn] of [
  ['row3-profile-start', 'Start Profile start fresh', 'startAt=profile',
    () => !!document.body.textContent?.includes('How old are you?')],
  ['row4-mic-profile', 'Start Mic + Profile fresh', 'startAt=mic',
    () => !!document.querySelector('[aria-label="Microphone indicator"]')],
]) {
  await step(id, async () => {
    const page = await newQaPage();
    const before = resetCount();
    await page.click(`button[aria-label="${label}"]`);
    await page.waitForURL(`**/onboarding/flow?${q}`, { timeout: 60000 });
    let probed = true;
    try { await page.waitForFunction(probeFn, { timeout: 30000 }); } catch { probed = false; }
    await page.screenshot({ path: `${OUT}/${id}.png` });
    record(id, resetCount() === before + 1 && probed ? 'PASS' : 'FAIL',
      `wipe=+${resetCount() - before}; url=${page.url()}; activeCardProbe=${probed}`);
    await page.close();
  });
}

fs.writeFileSync(`${OUT}/rerun-results.json`, JSON.stringify({ results, net }, null, 2));
console.log('\nSUMMARY:', results.map((r) => `${r.id}=${r.verdict}`).join(' | '));
await browser.close();
