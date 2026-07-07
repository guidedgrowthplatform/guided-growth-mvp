// W2-G live verification: QA self-reset -> reload -> confirm no prior-session
// data resurfaces. Uses the real qa-onboarding-fable@guidedgrowth.test account
// against a live CI preview (no writes beyond that one QA user; self-reset is
// pattern-gated server-side to qa-onboarding-*@guidedgrowth.test).
//
// Sequence per run:
//   1. Sign in as the QA user via /onboarding/qa (real Supabase auth).
//   2. Write a DISTINCTIVE onboarding_states row via the real save API
//      (PUT /api/onboarding, same call the app makes) -- this is a genuine
//      server-persisted row with a real updated_at, not a UI mock.
//   3. Click "Reset data only" (api/qa/self-reset -> real DELETE FROM
//      onboarding_states, same server code path the bug report names).
//   4. Reload the page fresh (new mount => useOnboardingRealtimeSync
//      re-subscribes on an EMPTY cache -- this is the exact window the fix
//      closes) and watch the onboarding_states network traffic for several
//      seconds.
//   5. Assert the distinctive marker never appears anywhere in the DOM or in
//      any onboarding_states response body after the reload.
//
// Run 3x per the task's done-condition (loop below).
import { chromium } from 'playwright';

const BASE = process.env.PREVIEW_URL;
if (!BASE) {
  console.error('PREVIEW_URL env var required');
  process.exit(1);
}
const QA_EMAIL = 'qa-onboarding-fable@guidedgrowth.test';
const RUNS = Number(process.env.RUNS ?? 3);

async function runOnce(browser, runIndex) {
  const marker = `w2g-marker-${Date.now()}-${runIndex}`;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const onboardingStateResponses = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (
      url.includes('onboarding_states') ||
      url.includes('/api/onboarding') ||
      url.includes('self-reset')
    ) {
      let body = '';
      try {
        body = await res.text();
      } catch {
        /* non-text body, ignore */
      }
      onboardingStateResponses.push({ t: Date.now(), url, status: res.status(), body });
    }
  });

  const consoleLines = [];
  page.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`));

  // 1. Load QA control screen, pick the fable account.
  await page.goto(`${BASE}/onboarding/qa`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('select[aria-label="Test user"]', { timeout: 20000 });
  await page.selectOption('select[aria-label="Test user"]', QA_EMAIL);

  // "Restart onboarding (fresh)" signs in AND wipes AND navigates to real
  // onboarding -- gives us a clean, signed-in, empty-server-state starting
  // point before we inject our own distinctive row.
  await page.click('button:has-text("Restart onboarding (fresh)")');
  await page.waitForURL('**/onboarding/flow', { timeout: 45000 });

  // 2. Inject a DISTINCTIVE server-persisted row via the real save API, from
  // inside the authenticated page context (real session token, real RLS).
  // Read the access token straight out of Supabase's own localStorage entry
  // (key `sb-<project-ref>-auth-token`) instead of importing the app's TS
  // source (which isn't resolvable against a built/bundled prod deploy).
  const saveResult = await page.evaluate(async (markerValue) => {
    const authKey = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
    );
    if (!authKey) return { ok: false, reason: 'no supabase auth-token key in localStorage' };
    let token;
    try {
      const parsed = JSON.parse(localStorage.getItem(authKey));
      token = parsed?.access_token;
    } catch {
      return { ok: false, reason: 'auth-token value not parseable JSON' };
    }
    if (!token) return { ok: false, reason: 'no access_token on parsed session' };
    const res = await fetch('/api/onboarding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        step: 3,
        path: 'beginner',
        data: { nickname: markerValue },
      }),
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  }, marker);

  if (!saveResult.ok) {
    return {
      run: runIndex,
      verdict: 'ERROR',
      reason: `distinctive save failed: ${JSON.stringify(saveResult)}`,
    };
  }

  // Give Realtime a moment to echo the save back over the same channel this
  // page is subscribed on (normal echo case, should be accepted and match).
  await page.waitForTimeout(1500);

  // 3. Reset data only (real self-reset endpoint, stays on the QA screen).
  await page.goto(`${BASE}/onboarding/qa`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('select[aria-label="Test user"]', { timeout: 20000 });
  await page.selectOption('select[aria-label="Test user"]', QA_EMAIL);
  // Wait for the actual self-reset network response directly rather than
  // inferring it from array-length timing (the QA screen's fresh page load
  // fires a lot of other traffic — voice preloads, thread fetch, context
  // state — and the self-reset call can land after the "Data wiped for" UI
  // text is already painted).
  const [resetResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('self-reset'), { timeout: 30000 }),
    page.click('button:has-text("Reset data only")'),
  ]);
  const resetFired = resetResponse.status() === 200;
  if (!resetFired) {
    return {
      run: runIndex,
      verdict: 'ERROR',
      reason: `self-reset returned ${resetResponse.status()}`,
    };
  }
  await page.waitForFunction(() => !!document.body.textContent?.includes('Data wiped for'), {
    timeout: 30000,
  });

  // 4. Fresh page load (new mount, empty cache, hook re-subscribes) -- the
  // exact window isProvenanceStaleOnEmptyCache guards. Mark the response
  // array HERE so step 5 only inspects traffic from after the reload --
  // earlier entries legitimately contain the marker (our own save in step 2
  // echoes it back), which is not the bug this checks for.
  const netMarkBeforeReload = onboardingStateResponses.length;
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // 5. Assert the marker never resurfaces: not in the DOM, not in any
  // onboarding_states / /api/onboarding response body seen after the reload.
  const bodyText = (await page.textContent('body')) ?? '';
  const domHasMarker = bodyText.includes(marker);
  const postReloadResponses = onboardingStateResponses.slice(netMarkBeforeReload);
  const anyResponseHasMarker = postReloadResponses.some((r) => r.body?.includes(marker));

  await ctx.close();

  const pass = !domHasMarker && !anyResponseHasMarker;
  return {
    run: runIndex,
    verdict: pass ? 'PASS' : 'FAIL',
    marker,
    domHasMarker,
    anyResponseHasMarker,
    postReloadResponsesSeen: postReloadResponses.length,
    consoleErrorCount: consoleLines.filter((l) => l.startsWith('error')).length,
  };
}

const browser = await chromium.launch();
const results = [];
for (let i = 1; i <= RUNS; i++) {
  const r = await runOnce(browser, i);
  results.push(r);
  console.log(`[run ${i}] ${r.verdict} :: ${JSON.stringify(r)}`);
}
await browser.close();

console.log('\nSUMMARY:', results.map((r) => `run${r.run}=${r.verdict}`).join(' | '));
const allPass = results.every((r) => r.verdict === 'PASS');
process.exit(allPass ? 0 : 1);
