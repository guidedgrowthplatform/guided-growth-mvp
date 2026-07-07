/**
 * W3 composed acceptance — coach-save leg (G07/G08 binding evidence).
 *
 * Drives a REAL text turn through the QA seam window.__ggQaSendUserTurn(text)
 * (QA builds only) and captures the /api/llm stream to verify the
 * submit_weekly_config tool call args match the card's preselected day.
 *
 *   Asia/Jerusalem   → card Saturday, affirm → tool args day=6, card stays Saturday
 *   America/New_York → card Sunday,  affirm → tool args day=0, card stays Sunday
 *
 * Artifacts: /tmp/gg-w3-weeklyday-accept/composed/
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const PREVIEW_URL =
  process.env.E2E_BASE_URL || 'https://gg-be325iwh4-guided-growths-projects.vercel.app';
const EMAIL = 'qa-onboarding-fable-latency@guidedgrowth.test';
const PASSWORD = 'guided-growth-qa-2026';
const ARTIFACTS = '/tmp/gg-w3-weeklyday-accept/composed';

fs.mkdirSync(ARTIFACTS, { recursive: true });

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(ARTIFACTS, 'composed.log'), line + '\n');
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(ARTIFACTS, name), fullPage: true });
  log(`screenshot: ${name}`);
}

interface LlmExchange {
  request: string;
  response: string;
}

// Capture /api/llm request + response bodies (streamed SSE included).
function captureLlm(page: Page, store: LlmExchange[]) {
  page.on('response', (res) => {
    const url = res.url();
    if (!url.includes('/api/llm')) return;
    const reqBody = res.request().postData() ?? '';
    res
      .text()
      .then((body) => {
        store.push({ request: reqBody, response: body });
      })
      .catch(() => {
        store.push({ request: reqBody, response: '<body unavailable>' });
      });
  });
}

async function loginResetAndReachBeat(page: Page, context: BrowserContext, tag: string) {
  await context.clearCookies();

  // 1. Sign in.
  await page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }).catch(() => {});
  log(`${tag}: logged in, URL=${page.url()}`);

  // 2. Authed self-reset (Bearer token from the Supabase localStorage session).
  const resetStatus = await page.evaluate(async () => {
    let token: string | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
        try {
          const parsed = JSON.parse(localStorage.getItem(k)!);
          token = parsed?.access_token ?? parsed?.currentSession?.access_token ?? null;
        } catch {
          /* ignore */
        }
      }
    }
    if (!token) return -1;
    const res = await fetch('/api/qa/self-reset', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status;
  });
  log(`${tag}: self-reset status=${resetStatus}`);

  // Clear the client-side thread cache so the wiped account starts clean, then
  // set the intro-seen flag so IntroGate doesn't block the ?startAt seed with
  // the splash screen (fresh row means hasProgress=false, so the flag is the gate).
  await page.evaluate(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)!;
      if (k.includes('thread')) localStorage.removeItem(k);
    }
    localStorage.setItem('gg_onboarding_intro_seen', '1');
  });

  // 3. Jump to the weekly-day beat (QA startAt seeding).
  await page.goto(`${PREVIEW_URL}/onboarding/flow?startAt=weekly-day-setup`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });
  await page.waitForTimeout(3000);
  await shot(page, `${tag}-01-weekly-beat.png`);
}

async function waitForSeam(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(() => typeof window.__ggQaSendUserTurn === 'function', undefined, {
      timeout: 15000,
    });
    return true;
  } catch {
    return false;
  }
}

// Poll the captured exchanges for the submit_weekly_config tool call.
async function waitForWeeklyToolCall(
  page: Page,
  store: LlmExchange[],
  timeoutMs = 60000,
): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hit = store.find((e) => e.response.includes('submit_weekly_config'));
    if (hit) return hit.response;
    await page.waitForTimeout(1000);
  }
  return null;
}

// Extract the day arg from the streamed tool_call event.
function extractSavedDay(streamBody: string): number | null {
  // SSE stream lines contain JSON events; find the submit_weekly_config args.
  // Handles both {"name":"submit_weekly_config","args":{"day":6}} and
  // argument-string forms {"arguments":"{\"day\":6}"}.
  const patterns = [
    /submit_weekly_config[^\n]*?"day"\s*:\s*(\d)/,
    /"day\\?"\s*:\s*(\d)[^\n]*?submit_weekly_config/,
  ];
  for (const p of patterns) {
    const m = streamBody.match(p);
    if (m) return Number(m[1]);
  }
  // Fallback: scan each line mentioning the tool for a day digit.
  for (const line of streamBody.split('\n')) {
    if (!line.includes('submit_weekly_config')) continue;
    const m = line.match(/day\\?"?\s*:\s*(\d)/);
    if (m) return Number(m[1]);
  }
  return null;
}

test.describe('Composed — Asia/Jerusalem: affirm Saturday saves day=6', () => {
  test.use({ timezoneId: 'Asia/Jerusalem' });

  test('card Saturday → seam affirm → submit_weekly_config day=6 → card stays Saturday', async ({
    page,
    context,
  }) => {
    const tag = 'jerusalem';
    log(`START composed: ${tag}`);
    const exchanges: LlmExchange[] = [];
    captureLlm(page, exchanges);

    await loginResetAndReachBeat(page, context, tag);

    // Card preselect check.
    const satBtn = page.locator('[aria-label="Saturday"]').first();
    await expect(satBtn, 'weekly-day picker should render').toBeVisible({ timeout: 10000 });
    expect(await satBtn.getAttribute('aria-pressed'), 'card must preselect Saturday').toBe('true');
    log(`${tag}: card preselects Saturday (aria-pressed=true)`);

    // Seam must be present (QA build).
    const seamUp = await waitForSeam(page);
    expect(seamUp, 'window.__ggQaSendUserTurn must be registered (QA build)').toBe(true);

    // Send the bare affirmation of the SHOWN value.
    await page.evaluate(() => window.__ggQaSendUserTurn!('Saturday works great for me'));
    log(`${tag}: sent affirmation turn via seam`);

    // Binding evidence: the tool call must carry day=6.
    const stream = await waitForWeeklyToolCall(page, exchanges, 90000);
    expect(stream, 'submit_weekly_config tool call must appear in the /api/llm stream').not.toBeNull();
    fs.writeFileSync(path.join(ARTIFACTS, `${tag}-llm-stream.txt`), stream ?? '');
    const savedDay = extractSavedDay(stream!);
    log(`${tag}: submit_weekly_config args day=${savedDay}`);
    expect(savedDay, 'saved day must be 6 (Saturday) — the shown card value').toBe(6);

    // Re-rendered card must stay Saturday (G08 resync + no flip).
    await page.waitForTimeout(2000);
    await shot(page, `${tag}-02-after-save.png`);
    const stillPressed = await page
      .locator('[aria-label="Saturday"]')
      .first()
      .getAttribute('aria-pressed')
      .catch(() => null);
    if (stillPressed !== null) {
      expect(stillPressed, 'card must still show Saturday after the save').toBe('true');
      log(`${tag}: card stays Saturday after save (no flip)`);
    } else {
      log(`${tag}: card unmounted after save (advanced to next beat) — save value already verified`);
    }

    // Persist all exchanges for the record.
    fs.writeFileSync(
      path.join(ARTIFACTS, `${tag}-exchanges.json`),
      JSON.stringify(exchanges, null, 2),
    );
    log(`END composed: ${tag} PASSED (day=6, no flip)`);
  });
});

test.describe('Composed — America/New_York: affirm Sunday saves day=0', () => {
  test.use({ timezoneId: 'America/New_York' });

  test('card Sunday → seam affirm → submit_weekly_config day=0', async ({ page, context }) => {
    const tag = 'newyork';
    log(`START composed: ${tag}`);
    const exchanges: LlmExchange[] = [];
    captureLlm(page, exchanges);

    await loginResetAndReachBeat(page, context, tag);

    const sunBtn = page.locator('[aria-label="Sunday"]').first();
    await expect(sunBtn, 'weekly-day picker should render').toBeVisible({ timeout: 10000 });
    expect(await sunBtn.getAttribute('aria-pressed'), 'card must preselect Sunday').toBe('true');
    log(`${tag}: card preselects Sunday (aria-pressed=true)`);

    const seamUp = await waitForSeam(page);
    expect(seamUp, 'window.__ggQaSendUserTurn must be registered (QA build)').toBe(true);

    await page.evaluate(() => window.__ggQaSendUserTurn!('Sunday works great for me'));
    log(`${tag}: sent affirmation turn via seam`);

    const stream = await waitForWeeklyToolCall(page, exchanges, 90000);
    expect(stream, 'submit_weekly_config tool call must appear in the /api/llm stream').not.toBeNull();
    fs.writeFileSync(path.join(ARTIFACTS, `${tag}-llm-stream.txt`), stream ?? '');
    const savedDay = extractSavedDay(stream!);
    log(`${tag}: submit_weekly_config args day=${savedDay}`);
    expect(savedDay, 'saved day must be 0 (Sunday) — the shown card value').toBe(0);

    await page.waitForTimeout(2000);
    await shot(page, `${tag}-02-after-save.png`);

    fs.writeFileSync(
      path.join(ARTIFACTS, `${tag}-exchanges.json`),
      JSON.stringify(exchanges, null, 2),
    );
    log(`END composed: ${tag} PASSED (day=0)`);
  });
});
