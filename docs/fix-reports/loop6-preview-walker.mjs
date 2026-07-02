// Loop 6 QA-screen live verification walker. No-write beyond the fable QA user
// (self-reset endpoints only accept qa-onboarding-*@guidedgrowth.test).
// Fresh page per section (SPA wedges when leaving a flow route); the row11->row2
// warm-heap pair deliberately shares one page.
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
const consoleErrors = [];
const attach = (page) => {
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/api/qa/self-reset') || u.includes('onboarding_states') || u.includes('/api/qa/users'))
      net.push({ t: Date.now(), m: r.method(), u });
  });
  page.on('response', (r) => {
    if (r.url().includes('/api/qa/self-reset')) net.push({ t: Date.now(), m: 'RESP', u: r.url(), status: r.status() });
  });
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
};

const newQaPage = async () => {
  const page = await ctx.newPage();
  attach(page);
  await page.goto(`${BASE}/onboarding/qa`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('select[aria-label="Test user"]', { timeout: 20000 });
  await page.selectOption('select[aria-label="Test user"]', 'qa-onboarding-fable@guidedgrowth.test');
  return page;
};
const resetCount = () => net.filter((n) => n.m === 'POST' && n.u.includes('self-reset')).length;
const lastResetOk = () => {
  const r = [...net].reverse().find((n) => n.m === 'RESP' && n.u.includes('self-reset'));
  return r?.status === 200;
};

const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    record(id, 'ERROR', String(e).split('\n')[0]);
  }
};

// ---- Row 1: dropdown live list
await step('row1-dropdown', async () => {
  const page = await newQaPage();
  await page.waitForTimeout(2500);
  const options = await page.$$eval('select[aria-label="Test user"] option', (os) => os.map((o) => o.value));
  record('row1-dropdown', options.includes('qa-onboarding-fable@guidedgrowth.test') ? 'PASS' : 'FAIL',
    `options=${JSON.stringify(options)}`);
  await page.close();
});

// ---- Rows 5/6/7: preview tiles must NOT wipe
for (const [id, label, urlPart] of [
  ['row6-morning-no-wipe', 'Start Morning check-in fresh', 'flow-preview/morning-checkin'],
  ['row7-evening-no-wipe', 'Start Evening check-in fresh', 'flow-preview/evening-checkin'],
  ['row5-home-tour-no-wipe', 'Start Home tour fresh', 'flow-preview/home-tour'],
]) {
  await step(id, async () => {
    const page = await newQaPage();
    const before = resetCount();
    await page.click(`button[aria-label="${label}"]`);
    await page.waitForURL(`**/${urlPart}`, { timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/${id}.png` });
    record(id, resetCount() === before ? 'PASS' : 'FAIL',
      `self-resets: ${resetCount() - before}; landed=${page.url()}`);
    await page.close();
  });
}

// ---- Row 11 (stay-put reset) THEN rows 2+B22 on the SAME warm page
await step('row11+row2-warm-heap', async () => {
  const page = await newQaPage();
  let before = resetCount();
  await page.click('button:has-text("Reset data only")');
  await page.waitForFunction(() => !!document.body.textContent?.includes('Data wiped for'), { timeout: 30000 });
  const stayedPut = page.url().includes('/onboarding/qa');
  await page.screenshot({ path: `${OUT}/row11-reset-stays.png` });
  record('row11-reset-stays', stayedPut && resetCount() === before + 1 && lastResetOk() ? 'PASS' : 'FAIL',
    `url=${page.url()}; resets=+${resetCount() - before}; reset200=${lastResetOk()}`);

  before = resetCount();
  const netMark = net.length;
  await page.click('button[aria-label="Start Full onboarding fresh"]');
  await page.waitForURL('**/onboarding/flow', { timeout: 45000 });
  await page.waitForTimeout(6000);
  const resetAt = net.slice(netMark).find((n) => n.m === 'POST' && n.u.includes('self-reset'))?.t;
  const stateReadAfter = net.slice(netMark).some(
    (n) => n.m === 'GET' && n.u.includes('onboarding_states') && resetAt && n.t > resetAt);
  await page.screenshot({ path: `${OUT}/row2-full-onboarding.png` });
  record('row2-full-onboarding-fresh', resetCount() === before + 1 && lastResetOk() ? 'PASS' : 'FAIL',
    `wipe fired=${resetCount() - before}; landed=${page.url()}`);
  record('row2-b22-fresh-state-read', stateReadAfter ? 'PASS' : 'FAIL',
    `onboarding_states GET after reset in same heap: ${stateReadAfter}`);
  await page.close();
});

// ---- Row 10: Replay = preview route, NO wipe
await step('row10-replay-no-wipe', async () => {
  const page = await newQaPage();
  const before = resetCount();
  await page.click('button:has-text("Replay flow (preview)")');
  await page.waitForURL('**/onboarding-flow-preview', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/row10-replay-preview.png` });
  record('row10-replay-no-wipe', resetCount() === before ? 'PASS' : 'FAIL',
    `self-resets: ${resetCount() - before}; landed=${page.url()}`);
  await page.close();
});

// ---- Row 8: Log in = real routing (fable in-progress after row 2's restart)
await step('row8-login-real-routing', async () => {
  const page = await newQaPage();
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/onboarding/flow', { timeout: 45000 });
  await page.screenshot({ path: `${OUT}/row8-login.png` });
  record('row8-login-real-routing', 'PASS', `landed=${page.url()} (AppGate resume for in-progress user)`);
  await page.close();
});

// ---- Rows 3/4: startAt tiles
for (const [id, label, q, probe] of [
  ['row3-profile-start', 'Start Profile start fresh', 'startAt=profile', /age/i],
  ['row4-mic-profile', 'Start Mic + Profile fresh', 'startAt=mic', /mic/i],
]) {
  await step(id, async () => {
    const page = await newQaPage();
    const before = resetCount();
    await page.click(`button[aria-label="${label}"]`);
    await page.waitForURL(`**/onboarding/flow?${q}`, { timeout: 45000 });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${OUT}/${id}.png` });
    const body = (await page.textContent('body')) ?? '';
    record(id, resetCount() === before + 1 ? 'PASS' : 'FAIL',
      `wipe=+${resetCount() - before}; url=${page.url()}; probeUI=${probe.test(body)}`);
    await page.close();
  });
}

// ---- Row 9: Restart button always full onboarding
await step('row9-restart-full-onboarding', async () => {
  const page = await newQaPage();
  const before = resetCount();
  await page.click('button:has-text("Restart onboarding (fresh)")');
  await page.waitForURL('**/onboarding/flow', { timeout: 45000 });
  const notPreview = !page.url().includes('flow-preview');
  await page.screenshot({ path: `${OUT}/row9-restart-full.png` });
  record('row9-restart-full-onboarding', notPreview && resetCount() === before + 1 ? 'PASS' : 'FAIL',
    `landed=${page.url()}; wipe=+${resetCount() - before}`);
  await page.close();
});

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, net, consoleErrors }, null, 2));
console.log('\nSUMMARY:', results.map((r) => `${r.id}=${r.verdict}`).join(' | '));
await browser.close();
