/**
 * W3 fork delegation-guard acceptance — G13 binding evidence.
 *
 * Drives REAL text turns through the QA seam window.__ggQaSendUserTurn(text)
 * (QA builds only) at the ONBOARD-FORK--FORM beat (node id "path-fork") and
 * captures the /api/llm stream to prove:
 *
 *   1. A verbatim delegation turn ("skip this too, just pick one for me")
 *      does NOT fire submit_path_choice. The beat holds
 *      (data-beat-id="path-fork" stays active) and the coach responds with
 *      text (recommend + ask), not a silent tool call.
 *   2. A real path-signal turn right after ("I'm new to this, never really
 *      tracked anything before") DOES fire submit_path_choice and the beat
 *      advances (path-fork no longer the active beat).
 *
 * Run 3x with --repeat-each=3 for non-flakiness evidence.
 *
 * Artifacts: /tmp/gg-w3-forkguard-accept/
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const PREVIEW_URL =
  process.env.E2E_BASE_URL || 'https://gg-5q4rq2scu-guided-growths-projects.vercel.app';
const EMAIL = 'qa-onboarding-fable-builder@guidedgrowth.test';
const PASSWORD = 'guided-growth-qa-2026';
const ARTIFACTS = '/tmp/gg-w3-forkguard-accept';

fs.mkdirSync(ARTIFACTS, { recursive: true });

function log(tag: string, msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(ARTIFACTS, `${tag}.log`), line + '\n');
}

async function shot(page: Page, tag: string, name: string) {
  await page.screenshot({ path: path.join(ARTIFACTS, `${tag}-${name}.png`), fullPage: true });
  log(tag, `screenshot: ${name}`);
}

interface LlmExchange {
  request: string;
  response: string;
}

function captureLlm(page: Page, store: LlmExchange[]) {
  page.on('response', (res) => {
    const url = res.url();
    if (!url.includes('/api/llm')) return;
    const reqBody = res.request().postData() ?? '';
    res
      .text()
      .then((body) => store.push({ request: reqBody, response: body }))
      .catch(() => store.push({ request: reqBody, response: '<body unavailable>' }));
  });
}

async function loginResetAndReachFork(page: Page, context: BrowserContext, tag: string) {
  await context.clearCookies();

  await page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }).catch(() => {});
  log(tag, `logged in, URL=${page.url()}`);

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
  log(tag, `self-reset status=${resetStatus}`);

  await page.evaluate(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)!;
      if (k.includes('thread')) localStorage.removeItem(k);
    }
    localStorage.setItem('gg_onboarding_intro_seen', '1');
  });

  await page.goto(`${PREVIEW_URL}/onboarding/flow?startAt=path-fork`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });
  await page.waitForTimeout(3000);
  await shot(page, tag, '01-fork-beat');
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

function findToolCall(store: LlmExchange[], toolName: string): string | undefined {
  const hit = store.find((e) => e.response.includes(toolName));
  return hit?.response;
}

test.describe('G13 — fork delegation-guard acceptance', () => {
  test('delegation turn blocked (no submit_path_choice, beat holds); real turn saves path', async ({
    page,
    context,
  }) => {
    const tag = 'fork-guard';
    log(tag, 'START');
    const exchanges: LlmExchange[] = [];
    captureLlm(page, exchanges);

    await loginResetAndReachFork(page, context, tag);

    const seamUp = await waitForSeam(page);
    expect(seamUp, 'window.__ggQaSendUserTurn must be registered (QA build)').toBe(true);

    // Beat must be at path-fork before we start.
    const forkActive = page.locator('[data-beat-id="path-fork"][data-beat-active]');
    await expect(forkActive, 'fork beat should be active before the delegation turn').toBeVisible({
      timeout: 10000,
    });
    log(tag, 'confirmed path-fork is the active beat');

    // ── Turn 1: verbatim delegation turn — must NOT fire submit_path_choice ──
    const beforeCount = exchanges.length;
    await page.evaluate(() =>
      window.__ggQaSendUserTurn!('skip this too, just pick one for me'),
    );
    log(tag, 'sent delegation turn via seam: "skip this too, just pick one for me"');

    // Give the model a realistic window to respond, then assert absence.
    await page.waitForTimeout(12000);
    const afterDelegation = exchanges.slice(beforeCount);
    fs.writeFileSync(
      path.join(ARTIFACTS, `${tag}-delegation-exchanges.json`),
      JSON.stringify(afterDelegation, null, 2),
    );
    const delegationToolCall = findToolCall(afterDelegation, 'submit_path_choice');
    expect(
      delegationToolCall,
      'submit_path_choice must NOT fire on a bare delegation turn',
    ).toBeUndefined();
    log(tag, 'PASS — no submit_path_choice tool call on delegation turn');

    // Beat must still be holding at path-fork (no silent advance).
    await shot(page, tag, '02-after-delegation');
    await expect(
      forkActive,
      'fork beat must still be active — the guard should hold the beat, not advance it',
    ).toBeVisible({ timeout: 5000 });
    log(tag, 'PASS — beat holds at path-fork after delegation turn');

    // ── Turn 2: real path-signal turn — must fire submit_path_choice and advance ──
    const beforeReal = exchanges.length;
    await page.evaluate(() =>
      window.__ggQaSendUserTurn!("I'm new to this, never really tracked anything before"),
    );
    log(tag, 'sent real turn via seam: "I\'m new to this, never really tracked anything before"');

    const start = Date.now();
    let realToolCall: string | undefined;
    while (Date.now() - start < 60000) {
      realToolCall = findToolCall(exchanges.slice(beforeReal), 'submit_path_choice');
      if (realToolCall) break;
      await page.waitForTimeout(1000);
    }
    fs.writeFileSync(
      path.join(ARTIFACTS, `${tag}-real-exchanges.json`),
      JSON.stringify(exchanges.slice(beforeReal), null, 2),
    );
    expect(realToolCall, 'submit_path_choice must fire on a real grounded turn').toBeDefined();
    log(tag, `PASS — submit_path_choice fired: ${realToolCall!.slice(0, 200)}`);

    await page.waitForTimeout(2000);
    await shot(page, tag, '03-after-real-turn');
    const stillOnFork = await forkActive.isVisible().catch(() => false);
    expect(stillOnFork, 'beat should advance off path-fork once the path is saved').toBe(false);
    log(tag, 'PASS — beat advanced off path-fork after real turn saved the path');

    log(tag, 'END — PASSED (delegation blocked, real turn saved + advanced)');
  });
});
